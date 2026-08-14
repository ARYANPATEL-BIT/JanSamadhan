import Image from "next/image";
import { getTranslations } from "next-intl/server";

export async function Masthead() {
  const t = await getTranslations();

  return (
    <div className="gov-masthead">
      <div className="gov-container gov-masthead__inner">
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

        <div className="gov-masthead__tools">
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

          <div className="gov-masthead__search">
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

        <div className="gov-masthead__dignitaries" aria-label={t("masthead.dignitariesLabel")}>
          <figure className="gov-masthead__dignitary">
            <div className="gov-masthead__photo">
              <Image
                src="/dignitaries/pm-narendra-modi.png"
                alt={t("masthead.pmAlt")}
                width={140}
                height={180}
                priority
              />
            </div>
            <figcaption>
              <strong>{t("masthead.pmName")}</strong>
              <span>{t("masthead.pmTitle")}</span>
            </figcaption>
          </figure>
          <figure className="gov-masthead__dignitary">
            <div className="gov-masthead__photo">
              <Image
                src="/dignitaries/nitin-gadkari.png"
                alt={t("masthead.ministerAlt")}
                width={140}
                height={180}
                priority
              />
            </div>
            <figcaption>
              <strong>{t("masthead.ministerName")}</strong>
              <span>{t("masthead.ministerTitle")}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}
