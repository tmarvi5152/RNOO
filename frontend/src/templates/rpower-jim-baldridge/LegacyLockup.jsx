import React from "react";

const LegacyLockup = ({ className = "", compact = false }) => {
  return (
    <div
      className={`rjb-legacy-lockup text-[11px] leading-relaxed text-white/55 ${className}`}
    >
      <span className="uppercase tracking-[0.18em] text-[#f6c453]/80">
        RPOWER Legacy
      </span>
      <div className={compact ? "mt-0.5" : "mt-1"}>
        In memory of Jim Baldridge
      </div>
    </div>
  );
};

export default LegacyLockup;
