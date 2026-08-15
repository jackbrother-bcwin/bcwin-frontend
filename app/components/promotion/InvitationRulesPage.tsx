"use client";

import React from "react";
import AgencyHeader from "./shared/AgencyHeader";
import { AGENCY_LEVEL_TABLE } from "./rebateTables";

interface Props {
  onBack: () => void;
  onOpenRebate: () => void;
}

export default function InvitationRulesPage({ onBack, onOpenRebate }: Props) {
  return (
    <div className="agency-page">
      <AgencyHeader title="Rules" onBack={onBack} />
      <div className="agency-scroll agency-rules">
        <h2 className="agency-rules-hero">【Promotion partner】program</h2>
        <p className="agency-rules-sub">This activity is valid for a long time</p>

        <RuleBlock
          n="01"
          body={
            <>
              There are <b>6 subordinate levels</b> in inviting friends, If A invites B, then B is a
              level 1 subordinate of A. If B invites C, then C is a level 1 subordinate of B and also
              a level 2 subordinate of A. If C invites D, then D is a level 1 subordinate of C, at
              the same time a level 2 subordinate of B and also a level 3 subordinate of A.
            </>
          }
        />
        <RuleBlock
          n="02"
          body={
            <>
              When inviting friends to register, you must send the invitation link provided or enter
              the invitation code manually so that your friends become your level 1 subordinates.
            </>
          }
        />
        <RuleBlock
          n="03"
          body={
            <>
              When your invitee places bets, team rebate commission is recorded for your upline
              levels (L1–L6) according to the rebate ratio for that game category.
            </>
          }
        />
        <RuleBlock
          n="04"
          body={
            <>
              Unsettled team rebate is credited to the wallet every day at{" "}
              <b>1:30 AM</b> (IST). After settlement you can view it in the agency commission
              record and transaction history.
            </>
          }
        />
        <RuleBlock
          n="05"
          body={
            <>
              Commission rates vary depending on your agency level on that day
              <br />
              <b>Number of Teams:</b> How many downline deposits you have to date.
              <br />
              <b>Team Deposits:</b> The total number of deposits made by your downline in one day.
              <br />
              <b>Team Deposit:</b> Your downline deposits within one day.
            </>
          }
        />

        <div className="agency-level-table-wrap">
          <div className="agency-level-head">
            <span>Rebate level</span>
            <span>Team Number</span>
            <span>Team Betting</span>
            <span>Team Deposit</span>
          </div>
          {AGENCY_LEVEL_TABLE.map((row) => (
            <div key={row.level} className="agency-level-row">
              <span className="agency-level-crown">
                <CrownIcon /> {row.level}
              </span>
              <span>{row.team}</span>
              <span>{row.betting}</span>
              <span>{row.deposit}</span>
            </div>
          ))}
        </div>

        <RuleBlock
          n="06"
          body={
            <>
              The commission percentage depends on the membership level. The higher the membership
              level, the higher the bonus percentage. Different game types also have different payout
              percentages.
              <br />
              The commission rate is specifically explained as follows
              <br />
              <button type="button" className="agency-link-btn" onClick={onOpenRebate}>
                View rebate ratio &gt;&gt;
              </button>
            </>
          }
        />
        <RuleBlock
          n="07"
          body={<>TOP20 commission rankings will be randomly awarded with a separate bonus</>}
        />
        <RuleBlock
          n="08"
          body={<>The final interpretation of this activity belongs to BCWin</>}
        />
      </div>
    </div>
  );
}

function RuleBlock({ n, body }: { n: string; body: React.ReactNode }) {
  return (
    <div className="agency-rule-block">
      <div className="agency-rule-num">{n}</div>
      <div className="agency-rule-body">{body}</div>
    </div>
  );
}

function CrownIcon() {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden>
      <path
        d="M1 11.5h14L13.5 5l-3.2 3.2L8 2.5 5.7 8.2 2.5 5 1 11.5z"
        fill="#FED358"
        stroke="#C8922A"
        strokeWidth="0.6"
      />
      <rect x="1.5" y="11.5" width="13" height="1.8" rx="0.4" fill="#E8A84A" />
    </svg>
  );
}
