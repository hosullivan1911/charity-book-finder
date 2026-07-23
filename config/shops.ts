import type { Shop } from "../lib/types";

/**
 * Master shop list.
 *
 * Edit this file in GitHub to add, remove, or rename trial shops. Keep each
 * numeric `id` and `slug` unique. A Vercel deployment will publish the change,
 * and the intake API will keep the corresponding database shop records synced.
 */
export const masterShops: Shop[] = [
  {
    id: 1,
    slug: "harrys-test-shop",
    name: "Harry's Test Shop",
    address: "Perth, Western Australia",
    postcode: "6000",
    openingHours: "Trial shop · By arrangement",
    distance: "Test location",
  },
];
