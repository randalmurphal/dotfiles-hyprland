// Portal effect with render hook
#include <hyprland/src/plugins/PluginAPI.hpp>
#include <hyprland/src/desktop/Window.hpp>
#include <hyprland/src/render/OpenGL.hpp>
#include <hyprland/src/Compositor.hpp>
#include <hyprland/src/render/Renderer.hpp>
#include <hyprland/src/SharedDefs.hpp>
#include <chrono>
#include <unordered_map>

HANDLE PHANDLE = nullptr;

// Global callback handles - must be re-registered on each load
static SP<HOOK_CALLBACK_FN> g_closeWindowCallback;
static SP<HOOK_CALLBACK_FN> g_renderCallback;

struct ClosingWindow {
    Vector2D pos;
    Vector2D size;
    float startTime;
    float duration = 0.5f;
};

static std::unordered_map<uint64_t, ClosingWindow> g_closingWindows;

static float getTime() {
    static auto start = std::chrono::high_resolution_clock::now();
    auto now = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<float>(now - start).count();
}

APICALL EXPORT std::string PLUGIN_API_VERSION() {
    return HYPRLAND_API_VERSION;
}

APICALL EXPORT PLUGIN_DESCRIPTION_INFO PLUGIN_INIT(HANDLE handle) {
    PHANDLE = handle;
    Debug::log(LOG, "[PortalEffect] v17 init start");

    // closeWindow callback - store window info (re-register each load)
    g_closeWindowCallback = HyprlandAPI::registerCallbackDynamic(PHANDLE, "closeWindow",
        [&](void* self, SCallbackInfo& info, std::any data) {
            auto window = std::any_cast<PHLWINDOW>(data);
            if (!window || !window->m_realPosition || !window->m_realSize)
                return;

            ClosingWindow cw;
            cw.pos = window->m_realPosition->goal();
            cw.size = window->m_realSize->goal();
            cw.startTime = getTime();

            uint64_t id = (uint64_t)window.get();
            g_closingWindows[id] = cw;

            Debug::log(LOG, "[PortalEffect] v17 tracking window at ({},{}) {}x{}",
                cw.pos.x, cw.pos.y, cw.size.x, cw.size.y);
        });

    Debug::log(LOG, "[PortalEffect] v17 closeWindow registered");

    // Render hook - draw shrinking rectangles at POST_WINDOWS stage (re-register each load)
    g_renderCallback = HyprlandAPI::registerCallbackDynamic(PHANDLE, "render",
        [&](void* self, SCallbackInfo& info, std::any data) {
            // Only draw at LAST_MOMENT stage (final render before display)
            eRenderStage stage = std::any_cast<eRenderStage>(data);
            if (stage != RENDER_LAST_MOMENT)
                return;

            if (g_closingWindows.empty())
                return;

            Debug::log(LOG, "[PortalEffect] v17 render called with {} windows", g_closingWindows.size());

            // Check we have a valid render context
            auto monitor = g_pHyprOpenGL->m_renderData.pMonitor.lock();
            if (!monitor) {
                return;
            }

            float now = getTime();

            for (auto it = g_closingWindows.begin(); it != g_closingWindows.end();) {
                auto& cw = it->second;
                float elapsed = now - cw.startTime;
                float progress = elapsed / cw.duration;

                if (progress >= 1.0f) {
                    it = g_closingWindows.erase(it);
                    continue;
                }

                // TEST: Draw a bright red box at fixed position to verify rendering works
                CBox testBox = {100, 100, 200, 200};
                CHyprColor testColor(1.0f, 0.0f, 0.0f, 1.0f);  // Solid red
                g_pHyprOpenGL->renderRect(testBox, testColor, {});

                Debug::log(LOG, "[PortalEffect] v17 rendered test box at 100,100");

                // Request next frame
                g_pHyprRenderer->damageMonitor(monitor);
                ++it;
            }
        });

    Debug::log(LOG, "[PortalEffect] v17 render registered");

    return {"hypr-portal-effect", "Portal Effect v17", "Randy", "0.1.0"};
}

APICALL EXPORT void PLUGIN_EXIT() {
    g_closeWindowCallback.reset();
    g_renderCallback.reset();
    g_closingWindows.clear();
    Debug::log(LOG, "[PortalEffect] v17 exit");
}
