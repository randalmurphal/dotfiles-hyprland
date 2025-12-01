#include "PortalEffect.hpp"
#include "Shaders.hpp"
// PortalPassElement removed - rendering directly in render hook now

#include <hyprland/src/render/Renderer.hpp>
#include <hyprland/src/helpers/Color.hpp>

#include <hyprland/src/Compositor.hpp>
#include <hyprland/src/render/Renderer.hpp>
#include <hyprland/src/config/ConfigManager.hpp>

#include <cmath>
#include <chrono>
#include <random>
#include <GLES3/gl32.h>

// Global handle for config access
extern HANDLE PHANDLE;

// Utility to get current time in seconds
static float getCurrentTime() {
    static auto start = std::chrono::high_resolution_clock::now();
    auto now = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<float>(now - start).count();
}

// Random number generator for seeds
static float getRandomSeed() {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_real_distribution<float> dis(0.0f, 1000.0f);
    return dis(gen);
}

// ============================================================================
// CPortalEffectManager implementation
// ============================================================================

CPortalEffectManager::CPortalEffectManager() {
    Debug::log(LOG, "[PortalEffect] Effect manager created");
    readConfig();
}

CPortalEffectManager::~CPortalEffectManager() {
    // Clear all animations first to avoid dangling references
    m_mClosingWindows.clear();
    cleanupGL();
}

void CPortalEffectManager::readConfig() {
    // Read config values - these are registered in main.cpp
    static auto* const PDURATION = (Hyprlang::FLOAT* const*)HyprlandAPI::getConfigValue(PHANDLE, "plugin:hypr-portal-effect:duration")->getDataStaticPtr();
    static auto* const PROTSPEED = (Hyprlang::FLOAT* const*)HyprlandAPI::getConfigValue(PHANDLE, "plugin:hypr-portal-effect:rotation_speed")->getDataStaticPtr();
    static auto* const PWHIRLING = (Hyprlang::FLOAT* const*)HyprlandAPI::getConfigValue(PHANDLE, "plugin:hypr-portal-effect:whirling")->getDataStaticPtr();
    static auto* const PCOLOR    = (Hyprlang::INT* const*)HyprlandAPI::getConfigValue(PHANDLE, "plugin:hypr-portal-effect:color")->getDataStaticPtr();

    m_fDuration = **PDURATION;
    m_fRotationSpeed = **PROTSPEED;
    m_fWhirling = **PWHIRLING;
    m_uColor = **PCOLOR;

    Debug::log(LOG, "[PortalEffect] Config: duration={}, rotSpeed={}, whirl={}, color={:06x}",
               m_fDuration, m_fRotationSpeed, m_fWhirling, m_uColor);
}

bool CPortalEffectManager::initShaders() {
    if (m_bShadersInitialized)
        return true;

    Debug::log(LOG, "[PortalEffect] Initializing shaders...");

    try {
        // Use Hyprland's shader compilation helper
        m_iShaderProgram = g_pHyprOpenGL->createProgram(PORTAL_VERTEX_SHADER, PORTAL_FRAGMENT_SHADER, true);

        if (m_iShaderProgram == 0) {
            Debug::log(ERR, "[PortalEffect] Failed to compile portal shader!");
            return false;
        }
    } catch (const std::exception& e) {
        Debug::log(ERR, "[PortalEffect] Exception during shader compilation: {}", e.what());
        return false;
    } catch (...) {
        Debug::log(ERR, "[PortalEffect] Unknown exception during shader compilation");
        return false;
    }

    // Get uniform locations
    m_iLocProj = glGetUniformLocation(m_iShaderProgram, "proj");
    m_iLocProgress = glGetUniformLocation(m_iShaderProgram, "uProgress");
    m_iLocDuration = glGetUniformLocation(m_iShaderProgram, "uDuration");
    m_iLocSize = glGetUniformLocation(m_iShaderProgram, "uSize");
    m_iLocSeed = glGetUniformLocation(m_iShaderProgram, "uSeed");
    m_iLocColor = glGetUniformLocation(m_iShaderProgram, "uColor");
    m_iLocRotationSpeed = glGetUniformLocation(m_iShaderProgram, "uRotationSpeed");
    m_iLocWhirling = glGetUniformLocation(m_iShaderProgram, "uWhirling");
    m_iLocWindowTex = glGetUniformLocation(m_iShaderProgram, "uWindowTex");

    Debug::log(LOG, "[PortalEffect] Shader uniform locations: proj={}, progress={}, size={}, color={}",
               m_iLocProj, m_iLocProgress, m_iLocSize, m_iLocColor);

    // Create VAO and VBO for rendering a quad
    glGenVertexArrays(1, &m_iVAO);
    glGenBuffers(1, &m_iVBO);

    glBindVertexArray(m_iVAO);
    glBindBuffer(GL_ARRAY_BUFFER, m_iVBO);

    // Quad vertices: position (x,y) and texcoord (u,v)
    // We'll update these per-frame with actual window geometry
    float vertices[] = {
        // pos      // texcoord
        0.0f, 0.0f, 0.0f, 1.0f,  // bottom-left
        1.0f, 0.0f, 1.0f, 1.0f,  // bottom-right
        0.0f, 1.0f, 0.0f, 0.0f,  // top-left
        1.0f, 1.0f, 1.0f, 0.0f,  // top-right
    };

    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_DYNAMIC_DRAW);

    // Position attribute
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);

    // TexCoord attribute
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)(2 * sizeof(float)));
    glEnableVertexAttribArray(1);

    glBindVertexArray(0);
    glBindBuffer(GL_ARRAY_BUFFER, 0);

    m_bShadersInitialized = true;
    Debug::log(LOG, "[PortalEffect] Shaders initialized successfully");
    return true;
}

void CPortalEffectManager::cleanupGL() {
    if (m_iShaderProgram) {
        glDeleteProgram(m_iShaderProgram);
        m_iShaderProgram = 0;
    }
    if (m_iVAO) {
        glDeleteVertexArrays(1, &m_iVAO);
        m_iVAO = 0;
    }
    if (m_iVBO) {
        glDeleteBuffers(1, &m_iVBO);
        m_iVBO = 0;
    }
    m_bShadersInitialized = false;
}

SP<CTexture> CPortalEffectManager::captureWindowTexture(PHLWINDOW window) {
    if (!window)
        return nullptr;

    // Check if Hyprland already has a snapshot for this window
    auto it = g_pHyprOpenGL->m_windowFramebuffers.find(window);
    if (it != g_pHyprOpenGL->m_windowFramebuffers.end() && it->second.isAllocated()) {
        Debug::log(LOG, "[PortalEffect] Using existing framebuffer for window");
        return it->second.getTexture();
    }

    // Request Hyprland to make a snapshot
    Debug::log(LOG, "[PortalEffect] Requesting window snapshot...");
    g_pHyprRenderer->makeSnapshot(window);

    // Now try to get the framebuffer again
    it = g_pHyprOpenGL->m_windowFramebuffers.find(window);
    if (it != g_pHyprOpenGL->m_windowFramebuffers.end() && it->second.isAllocated()) {
        Debug::log(LOG, "[PortalEffect] Got window snapshot texture");
        return it->second.getTexture();
    }

    Debug::log(WARN, "[PortalEffect] Could not capture window texture");
    return nullptr;
}

void CPortalEffectManager::onWindowClose(PHLWINDOW window) {
    if (!window) {
        Debug::log(WARN, "[PortalEffect] onWindowClose called with null window");
        return;
    }

    // Skip if we already have this window
    if (m_mClosingWindows.count(window) > 0) {
        Debug::log(LOG, "[PortalEffect] Window already tracked, skipping");
        return;
    }

    Debug::log(LOG, "[PortalEffect] Window closing: {}", window->m_title);

    // DON'T capture texture - just use geometry for now to test basic rendering
    ClosingWindow closing;
    closing.window = window;
    closing.startTime = getCurrentTime();
    closing.duration = m_fDuration;
    closing.active = true;
    closing.texture = nullptr;  // Skip texture for now
    closing.seed = getRandomSeed();

    // Get window geometry
    auto pos = window->m_realPosition->goal();
    auto size = window->m_realSize->goal();
    closing.geometry = CBox{pos.x, pos.y, size.x, size.y};

    m_mClosingWindows[window] = closing;

    Debug::log(LOG, "[PortalEffect] Tracked window at ({}, {}) size {}x{}, startTime={}",
               pos.x, pos.y, size.x, size.y, closing.startTime);

    // Request immediate redraw
    g_pHyprRenderer->damageBox(closing.geometry);
}

void CPortalEffectManager::onTick() {
    if (m_mClosingWindows.empty())
        return;

    float now = getCurrentTime();

    // Clean up finished animations and request damage for active ones
    for (auto it = m_mClosingWindows.begin(); it != m_mClosingWindows.end();) {
        float elapsed = now - it->second.startTime;
        float progress = elapsed / it->second.duration;

        if (progress >= 1.0f) {
            Debug::log(LOG, "[PortalEffect] Animation complete for window");
            it->second.active = false;
            it = m_mClosingWindows.erase(it);
        } else {
            // Request redraw for the window area to ensure animation renders
            if (g_pHyprRenderer) {
                g_pHyprRenderer->damageBox(it->second.geometry);
            }
            ++it;
        }
    }
}

void CPortalEffectManager::onRender(PHLMONITOR monitor) {
    if (m_mClosingWindows.empty())
        return;

    Debug::log(LOG, "[PortalEffect] onRender called with {} closing windows",
               m_mClosingWindows.size());

    float now = getCurrentTime();

    // Render each closing window effect directly
    for (auto& [window, closing] : m_mClosingWindows) {
        if (!closing.active)
            continue;

        float elapsed = now - closing.startTime;
        float progress = std::min(elapsed / closing.duration, 1.0f);

        // Extract color components from config
        float r = ((m_uColor >> 16) & 0xFF) / 255.0f;
        float g = ((m_uColor >> 8) & 0xFF) / 255.0f;
        float b = (m_uColor & 0xFF) / 255.0f;

        SPortalRenderData data;
        data.manager = this;
        data.windowTex = closing.texture;
        data.geometry = closing.geometry;
        data.progress = progress;
        data.duration = closing.duration;
        data.rotationSpeed = m_fRotationSpeed;
        data.whirling = m_fWhirling;
        data.colorR = r;
        data.colorG = g;
        data.colorB = b;
        data.seed = closing.seed;

        // Render directly during the render hook
        renderPortal(data, monitor);
        Debug::log(LOG, "[PortalEffect] Rendered portal, progress={:.2f}", progress);
    }
}

void CPortalEffectManager::renderPortal(const SPortalRenderData& data, PHLMONITOR monitor) {
    Debug::log(LOG, "[PortalEffect] renderPortal called, progress={:.2f}", data.progress);

    if (!monitor) {
        Debug::log(WARN, "[PortalEffect] renderPortal: monitor is null");
        return;
    }

    try {
        // Transform box to monitor-local coordinates
        CBox box = data.geometry;
        box.x -= monitor->m_position.x;
        box.y -= monitor->m_position.y;

        // Scale down the box based on progress (simple shrink effect for testing)
        float scale = 1.0f - data.progress;
        float centerX = box.x + box.w / 2.0f;
        float centerY = box.y + box.h / 2.0f;
        box.w *= scale;
        box.h *= scale;
        box.x = centerX - box.w / 2.0f;
        box.y = centerY - box.h / 2.0f;

        // Use Hyprland's renderRect for a simple colored box test
        CHyprColor portalColor(data.colorR, data.colorG, data.colorB, 1.0f - data.progress);

        // If we have the window texture, render it scaled down
        if (data.windowTex && data.windowTex->m_texID > 0) {
            Debug::log(LOG, "[PortalEffect] Rendering with window texture");
            CHyprOpenGLImpl::STextureRenderData texData;
            texData.a = 1.0f - data.progress;  // Fade out as animation progresses
            g_pHyprOpenGL->renderTexture(data.windowTex, box, texData);
        } else {
            // No texture - render a colored rectangle
            Debug::log(LOG, "[PortalEffect] Rendering colored rect (no texture)");
            CHyprOpenGLImpl::SRectRenderData rectData;
            g_pHyprOpenGL->renderRect(box, portalColor, rectData);
        }
    } catch (const std::exception& e) {
        Debug::log(ERR, "[PortalEffect] Exception in renderPortal: {}", e.what());
    } catch (...) {
        Debug::log(ERR, "[PortalEffect] Unknown exception in renderPortal");
    }
}
