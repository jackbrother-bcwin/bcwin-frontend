"use client";

/**
 * Static Activity promo — BC Win Salary Chart (full image).
 */

import React from "react";
import Image from "next/image";
import PageHeader from "../ui/PageHeader";
import { asset } from "../../lib/cdn";

const SALARY_CHART = asset("/assets/activity/salary-chart.jpg");

interface Props {
  onBack: () => void;
}

export default function SalaryChartPage({ onBack }: Props) {
  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      style={{ background: "#0a0f0a" }}
    >
      <PageHeader title="Salary chart" onBack={onBack} />

      <div className="px-2 sm:px-3 pt-2 pb-6">
        <div
          className="relative w-full overflow-hidden rounded-[12px]"
          style={{
            border: "1px solid rgba(254,211,88,0.2)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
          }}
        >
          {/* Full static chart — natural aspect from asset */}
          <Image
            src={SALARY_CHART}
            alt="BC Win Salary Chart — highest slab fully met is paid"
            width={1080}
            height={1600}
            className="w-full h-auto block select-none"
            sizes="(max-width: 480px) 100vw, 480px"
            priority
          />
        </div>
      </div>
    </div>
  );
}
