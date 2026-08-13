import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="gov-breadcrumbs" aria-label="Breadcrumb">
      <div className="gov-container">
        <nav aria-label="Breadcrumb navigation">
          {items.map((item, i) => (
            <span key={i}>
              {i > 0 && <span className="gov-breadcrumbs__separator" aria-hidden="true">&gt;</span>}
              {item.href && i < items.length - 1 ? (
                <Link href={item.href} style={{ textDecoration: "none" }}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={i === items.length - 1 ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}
