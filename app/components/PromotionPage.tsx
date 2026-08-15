"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { AgencyView } from "./promotion/types";
import AgencyHub from "./promotion/AgencyHub";
import InvitePage from "./promotion/InvitePage";
import SubordinateDataPage from "./promotion/SubordinateDataPage";
import NewSubordinatesPage from "./promotion/NewSubordinatesPage";
import AgentCommissionPage from "./promotion/AgentCommissionPage";
import CommissionDetailPage from "./promotion/CommissionDetailPage";
import SalaryDashboardPage from "./promotion/SalaryDashboardPage";
import InvitationRulesPage from "./promotion/InvitationRulesPage";
import RebateRatioPage from "./promotion/RebateRatioPage";
import { useSpaBackClose } from "../hooks/useSpaBackClose";

interface Props {
  onNavigate?: (screen: string) => void;
}

/** Reset document + any nested agency scroll panes so views open at the top. */
function resetAgencyScroll() {
  if (typeof window === "undefined") return;
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  document.querySelectorAll<HTMLElement>(".agency-scroll").forEach((el) => {
    el.scrollTop = 0;
  });
}

/**
 * Agency / Promotion — screenshot hub + internal pages (local view stack).
 * Nested views register SPA back layers so system-back returns to hub.
 */
export default function PromotionPage({ onNavigate }: Props) {
  const [view, setView] = useState<AgencyView>("hub");

  const backToHub = useCallback(() => {
    resetAgencyScroll();
    setView("hub");
  }, []);

  // System-back closes nested agency page before leaving Promotion tab
  useSpaBackClose(view !== "hub", backToHub, "agency-nested");

  useEffect(() => {
    resetAgencyScroll();
    const t = requestAnimationFrame(() => resetAgencyScroll());
    return () => cancelAnimationFrame(t);
  }, [view]);

  const open = (next: AgencyView) => {
    resetAgencyScroll();
    setView(next);
  };

  if (view === "invite") {
    return <InvitePage key="invite" onBack={backToHub} />;
  }
  if (view === "subordinates") {
    return <SubordinateDataPage key="subordinates" onBack={backToHub} />;
  }
  if (view === "newSubordinates") {
    return <NewSubordinatesPage key="newSubordinates" onBack={backToHub} />;
  }
  if (view === "commission") {
    return <AgentCommissionPage key="commission" onBack={backToHub} />;
  }
  if (view === "commissionDetail") {
    return (
      <CommissionDetailPage
        key="commissionDetail"
        onBack={backToHub}
        onOpenRebateRules={() => open("rebate")}
      />
    );
  }
  if (view === "salary") {
    return <SalaryDashboardPage key="salary" onBack={backToHub} />;
  }
  if (view === "rules") {
    return (
      <InvitationRulesPage
        key="rules"
        onBack={backToHub}
        onOpenRebate={() => open("rebate")}
      />
    );
  }
  if (view === "rebate") {
    return <RebateRatioPage key="rebate" onBack={backToHub} />;
  }

  return <AgencyHub key="hub" onOpen={open} onNavigate={onNavigate} />;
}
