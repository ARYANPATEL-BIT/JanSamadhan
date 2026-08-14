import Image from "next/image";
import { getTranslations } from "next-intl/server";

export async function Masthead() {
  const t = await getTranslations();

  return (
    <div className="gov-masthead">
      <div
        className="gov-container"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {/* Left: Crest + Identity */}
        <div className="gov-masthead__identity">
          <Image
            src="/crest.svg"
            alt={t("masthead.crestAlt")}
            width={60}
            height={60}
            className="gov-masthead__crest"
            priority
          />
          <div>
            <p className="gov-masthead__title-en">
              {t("masthead.corpName")}
            </p>
            <p className="gov-masthead__title-hi">
              {t("masthead.corpNameSub")}
            </p>
          </div>
        </div>

        {/* Right: Scheme logos + Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <div className="gov-masthead__schemes">
            <Image
              src="/scheme-digital.svg"
              alt={t("masthead.schemeDigitalAlt")}
              width={130}
              height={40}
              style={{ height: "36px", width: "auto" }}
            />
            <Image
              src="/scheme-swachh.svg"
              alt={t("masthead.schemeSwachhAlt")}
              width={130}
              height={40}
              style={{ height: "36px", width: "auto" }}
            />
          </div>

          {/* Search box */}
          <div className="gov-masthead__search" style={{ display: "flex" }}>
            <label htmlFor="masthead-search" className="sr-only">
              {t("common.searchAria")}
            </label>
            <input
              id="masthead-search"
              type="search"
              placeholder={t("common.searchPlaceholder")}
              aria-label={t("common.searchAria")}
            />
            <button type="button">{t("common.search")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
