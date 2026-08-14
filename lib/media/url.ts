/**
 * Insert Cloudinary fetch transforms so list/detail images are not full originals.
 */
export function optimizedMediaUrl(url: string, width: number): string {
  if (!url.includes("/upload/") || !url.includes("res.cloudinary.com")) return url;
  if (url.includes("/upload/f_auto,")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}
