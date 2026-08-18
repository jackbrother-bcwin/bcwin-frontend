"use client";

import React, { useEffect } from "react";
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
import { AGENCY_VIEW_SCREEN } from "../lib/spa-nested";

interface Props {
  view: AgencyView;
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

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
 * Agency / Promotion — hub + child pages.
 * Child views are hash screens (`#/promotion/agency-commission`).
 */
export default function PromotionPage({ view, onBack, onNavigate }: Props) {
  useEffect(() => {
    resetAgencyScroll();
    const t = requestAnimationFrame(() => resetAgencyScroll());
    return () => cancelAnimationFrame(t);
  }, [view]);

  const open = (next: AgencyView) => {
    resetAgencyScroll();
    if (next === "hub") {
      onBack();
      return;
    }
    onNavigate?.(AGENCY_VIEW_SCREEN[next]);
  };

  if (view === "invite") {
    return <InvitePage key="invite" onBack={onBack} />;
  }
  if (view === "subordinates") {
    return <SubordinateDataPage key="subordinates" onBack={onBack} />;
  }
  if (view === "newSubordinates") {
    return <NewSubordinatesPage key="newSubordinates" onBack={onBack} />;
  }
  if (view === "commission") {
    return <AgentCommissionPage key="commission" onBack={onBack} />;
  }
  if (view === "commissionDetail") {
    return (
      <CommissionDetailPage
        key="commissionDetail"
        onBack={onBack}
        onOpenRebateRules={() => open("rebate")}
      />
    );
  }
  if (view === "salary") {
    return <SalaryDashboardPage key="salary" onBack={onBack} />;
  }
  if (view === "rules") {
    return (
      <InvitationRulesPage
        key="rules"
        onBack={onBack}
        onOpenRebate={() => open("rebate")}
      />
    );
  }
  if (view === "rebate") {
    return <RebateRatioPage key="rebate" onBack={onBack} />;
  }

  return <AgencyHub key="hub" onOpen={open} onNavigate={onNavigate} />;
}
