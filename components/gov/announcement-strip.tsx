interface Announcement {
  date: string;
  text: string;
  isNew?: boolean;
  href?: string;
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    date: "13 Aug 2026",
    text: "Online grievance registration facility launched for all wards",
    isNew: true,
  },
  {
    date: "12 Aug 2026",
    text: "AI-powered duplicate detection enabled for complaint verification",
    isNew: true,
  },
  {
    date: "10 Aug 2026",
    text: "Ward-wise department routing system operational — complaints auto-assigned to concerned departments",
    isNew: true,
  },
  {
    date: "08 Aug 2026",
    text: "Civic Score system introduced to reward active citizen reporters",
    isNew: false,
  },
  {
    date: "05 Aug 2026",
    text: "GPS-verified photo capture mandatory for all new complaint registrations",
    isNew: false,
  },
  {
    date: "01 Aug 2026",
    text: "Public complaint feed now accessible without login — transparency initiative",
    isNew: false,
  },
];

export function AnnouncementStrip() {
  return (
    <div className="gov-announcements">
      <div className="gov-announcements__header">
        <span>Latest Updates / क्या नया है</span>
      </div>
      <ul className="gov-announcements__list">
        {ANNOUNCEMENTS.map((item, i) => (
          <li key={i} className="gov-announcements__item">
            <span className="gov-announcements__date">{item.date}</span>
            {item.isNew && (
              <span className="gov-announcements__new">New</span>
            )}
            <span>
              {item.href ? (
                <a href={item.href}>{item.text}</a>
              ) : (
                item.text
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
