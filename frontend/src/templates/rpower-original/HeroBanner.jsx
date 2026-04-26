import React from "react";
import rpowerHeroBanner from "../../images/RPOWER_HeroBanner.png";
import rpowerLogo from "../../images/rpower-logo.png";

const RpowerOriginalHeroBanner = ({ title, subtitle, compact = false }) => {
  return (
    <div className="px-4 sm:px-6 pt-4">
      <div
        className={`relative max-w-6xl mx-auto rounded-2xl overflow-hidden px-4 ${compact ? "min-h-[150px] sm:min-h-[170px]" : "min-h-[190px] sm:min-h-[240px]"}`}
        style={{
          backgroundImage: `url(${rpowerHeroBanner})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.08) 42%, rgba(0,0,0,0.22) 100%)",
          }}
        />

        <div className="absolute left-4 sm:left-6 bottom-4 sm:bottom-6 right-24 sm:right-36 z-10">
          <div
            className="inline-block max-w-full px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl"
            style={{
              background:
                "linear-gradient(180deg, rgba(15, 23, 42, 0.84) 0%, rgba(17, 24, 39, 0.9) 100%), var(--ro-btn-bg)",
              backgroundSize: "100% 100%, cover",
              backgroundPosition: "center",
              border: "1px solid rgba(255,255,255,0.16)",
              boxShadow: "0 12px 24px rgba(0,0,0,0.26)",
              backdropFilter: "blur(2px)",
            }}
          >
            <h1
              className={`${compact ? "text-[1.2rem] sm:text-[1.5rem]" : "text-[1.35rem] sm:text-[1.85rem]"} font-bold leading-tight`}
              style={{ color: "#ffffff" }}
            >
              {title}
            </h1>
            {subtitle && (
              <h3
                className={`${compact ? "text-[0.72rem] sm:text-[0.82rem]" : "text-[0.78rem] sm:text-[0.92rem]"} mt-1 leading-snug`}
                style={{ color: "#ffffff", fontWeight: 600 }}
              >
                {subtitle}
              </h3>
            )}
          </div>
        </div>

        <a
          href="https://www.rpowerpos.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open RPOWER POS website"
          className="absolute right-5 sm:right-6 bottom-1 sm:bottom-1 z-10"
        >
          <img
            src={rpowerLogo}
            alt="RPOWER POS"
            className={`${compact ? "w-[5.9rem] h-[5.9rem] sm:w-[7.1rem] sm:h-[7.1rem]" : "w-[6.8rem] h-[6.8rem] sm:w-[8.2rem] sm:h-[8.2rem]"} object-contain`}
          />
        </a>
      </div>
    </div>
  );
};

export default RpowerOriginalHeroBanner;
