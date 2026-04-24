import React from "react";
import rpowerLogo from "../../images/rpower-logo.png";

const RpowerBannerBadge = ({ className = "" }) => {
  const [imageError, setImageError] = React.useState(false);

  if (imageError) {
    return null;
  }

  return (
    <a
      href="https://www.rpowerpos.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Visit RPOWER POS website"
      className={`absolute bottom-3 right-3 z-20 inline-flex rounded-md bg-gradient-to-b from-[#1f232b] to-[#0c1018] p-[5px] shadow-[0_7px_16px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.02] active:translate-y-[1px] active:shadow-[0_4px_10px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 ${className}`}
    >
      <img
        src={rpowerLogo}
        alt="RPOWER"
        className="block h-8 w-auto md:h-10 rounded-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
        loading="lazy"
        onError={() => setImageError(true)}
      />
    </a>
  );
};

export default RpowerBannerBadge;
