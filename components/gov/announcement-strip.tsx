import { getTranslations } from "next-intl/server";

export async function AnnouncementStrip() {
  const t = await getTranslations("announcements");

  // Dates are locale-neutral display strings; the announcement text is keyed
  // (a1..a6) so it translates with the active locale.
  const announcements: { date: string; key: string; isNew: boolean }[] = [
    { date: "13 Aug 2026", key: "a1", isNew: true },
    { date: "12 Aug 2026", key: "a2", isNew: true },
    { date: "10 Aug 2026", key: "a3", isNew: true },
    { date: "08 Aug 2026", key: "a4", isNew: false },
    { date: "05 Aug 2026", key: "a5", isNew: false },
    { date: "01 Aug 2026", key: "a6", isNew: false },
  ];

  return (
    <div className="gov-announcements">
      <div className="gov-announcements__header">
        <span>{t("heading")}</span>
      </div>
      <ul className="gov-announcements__list">
        {announcements.map((item) => (
          <li key={item.key} className="gov-announcements__item">
            <span className="gov-announcements__date">{item.date}</span>
            {item.isNew && (
              <span className="gov-announcements__new">{t("new")}</span>
            )}
            <span>{t(item.key)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
