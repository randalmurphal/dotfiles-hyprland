#include "PortalPassElement.hpp"
#include <hyprland/src/render/OpenGL.hpp>

CPortalPassElement::CPortalPassElement(const SPortalRenderData& data) : m_data(data) {
    ;
}

void CPortalPassElement::draw(const CRegion& damage) {
    if (!m_data.manager)
        return;

    // Delegate rendering to the manager which has the shader program
    m_data.manager->renderPortal(m_data, g_pHyprOpenGL->m_renderData.pMonitor.lock());
}

bool CPortalPassElement::needsLiveBlur() {
    return false;
}

bool CPortalPassElement::needsPrecomputeBlur() {
    return false;
}

std::optional<CBox> CPortalPassElement::boundingBox() {
    return m_data.geometry;
}
