#pragma once

#include "PortalEffect.hpp"
#include <hyprland/src/render/pass/PassElement.hpp>

class CPortalPassElement : public IPassElement {
  public:
    CPortalPassElement(const SPortalRenderData& data);
    virtual ~CPortalPassElement() = default;

    virtual void                draw(const CRegion& damage) override;
    virtual bool                needsLiveBlur() override;
    virtual bool                needsPrecomputeBlur() override;
    virtual std::optional<CBox> boundingBox() override;

    virtual const char*         passName() override {
        return "CPortalPassElement";
    }

    // Non-pure virtual methods - need implementations since we don't link to Hyprland core
    virtual void                discard() override {}
    virtual bool                undiscardable() override { return false; }
    virtual CRegion             opaqueRegion() override { return {}; }
    virtual bool                disableSimplification() override { return false; }

  private:
    SPortalRenderData m_data;
};
