import Image from "next/image";

export function Masthead() {
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
            alt="Nagarpratinidhi Municipal Corporation Crest"
            width={60}
            height={60}
            className="gov-masthead__crest"
            priority
          />
          <div>
            <p className="gov-masthead__title-en">
              Nagarpratinidhi Municipal Corporation
            </p>
            <p className="gov-masthead__title-hi">
              नगरप्रतिनिधि नगर निगम
            </p>
          </div>
        </div>

        {/* Right: Scheme logos + Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <div className="gov-masthead__schemes">
            <Image
              src="/scheme-digital.svg"
              alt="Digital Nagarpratinidhi"
              width={130}
              height={40}
              style={{ height: "36px", width: "auto" }}
            />
            <Image
              src="/scheme-swachh.svg"
              alt="Swachh Nagarpratinidhi"
              width={130}
              height={40}
              style={{ height: "36px", width: "auto" }}
            />
          </div>

          {/* Search box */}
          <div className="gov-masthead__search" style={{ display: "flex" }}>
            <label htmlFor="masthead-search" className="sr-only">
              Search this website
            </label>
            <input
              id="masthead-search"
              type="search"
              placeholder="Search..."
              aria-label="Search this website"
            />
            <button type="button">Search</button>
          </div>
        </div>
      </div>
    </div>
  );
}
