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
    latitude: -31.9523,
    longitude: 115.8613,
  },
  {
    id: 2,
    slug: "toms-test-shop",
    name: "Tom's Test Shop",
    address: "Leederville, Western Australia",
    postcode: "6007",
    openingHours: "Trial shop · By arrangement",
    latitude: -31.93310379968666,
    longitude: 115.83822478457111,
  },
    {
    id: 3,
    slug: "jacks-test-shop",
    name: "Jack's Test Shop",
    address: "North Perth, Western Australia",
    postcode: "6006",
    openingHours: "Trial shop · By arrangement",
    latitude: -31.919166097316587,
    longitude: 115.85335974845265,
  }
];
