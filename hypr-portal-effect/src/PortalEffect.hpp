#pragma once

#include <hyprland/src/plugins/PluginAPI.hpp>
#include <hyprland/src/desktop/Window.hpp>
#include <hyprland/src/render/OpenGL.hpp>
#include <hyprland/src/render/Framebuffer.hpp>
#include <hyprland/src/render/Texture.hpp>

#include <deque>
#include <memory>
#include <unordered_map>

// Data passed to the portal pass element for rendering
struct SPortalRenderData {
    class CPortalEffectManager* manager = nullptr;
    SP<CTexture>          windowTex;
    CBox                  geometry;
    float                 progress = 0.0f;
    float                 duration = 0.5f;
    float                 rotationSpeed = 2.0f;
    float                 whirling = 1.0f;
    float                 colorR = 0.616f;  // Purple: #9d4edd
    float                 colorG = 0.306f;
    float                 colorB = 0.867f;
    float                 seed = 0.0f;
};

// Tracks a window that's being closed with our portal effect
struct ClosingWindow {
    PHLWINDOWREF        window;
    float               startTime;
    float               duration;
    bool                active;
    CBox                geometry;           // Window geometry at close start
    SP<CTexture>        texture;            // Captured window texture
    CFramebuffer        framebuffer;        // Framebuffer for the snapshot
    float               seed;               // Random seed for this animation
};

// Main effect manager
class CPortalEffectManager {
  public:
    CPortalEffectManager();
    ~CPortalEffectManager();

    void onWindowClose(PHLWINDOW window);
    void onTick();
    void onRender(PHLMONITOR monitor);

    // Render a portal effect - called from pass element
    void renderPortal(const SPortalRenderData& data, PHLMONITOR monitor);

    // Config getters
    float getAnimationDuration() const { return m_fDuration; }
    float getRotationSpeed() const { return m_fRotationSpeed; }
    float getWhirling() const { return m_fWhirling; }

    // Check if we have any active animations
    bool hasActiveAnimations() const { return !m_mClosingWindows.empty(); }

    // Get closing windows map for rendering
    const std::unordered_map<PHLWINDOW, ClosingWindow>& getClosingWindows() const { return m_mClosingWindows; }

  private:
    std::unordered_map<PHLWINDOW, ClosingWindow> m_mClosingWindows;

    // Configuration values (read from hyprland config)
    float       m_fDuration      = 0.5f;
    float       m_fRotationSpeed = 2.0f;
    float       m_fWhirling      = 1.0f;
    uint32_t    m_uColor         = 0x9d4edd;  // Purple

    // OpenGL resources
    GLuint      m_iShaderProgram = 0;
    GLuint      m_iVAO           = 0;
    GLuint      m_iVBO           = 0;
    bool        m_bShadersInitialized = false;

    // Shader uniform locations
    GLint       m_iLocProj          = -1;
    GLint       m_iLocProgress      = -1;
    GLint       m_iLocDuration      = -1;
    GLint       m_iLocSize          = -1;
    GLint       m_iLocSeed          = -1;
    GLint       m_iLocColor         = -1;
    GLint       m_iLocRotationSpeed = -1;
    GLint       m_iLocWhirling      = -1;
    GLint       m_iLocWindowTex     = -1;

    bool        initShaders();
    void        cleanupGL();
    SP<CTexture> captureWindowTexture(PHLWINDOW window);
    void        readConfig();
};

// Global instance
inline std::unique_ptr<CPortalEffectManager> g_pPortalEffect;
