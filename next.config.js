/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Hanya foto bukti dari bucket Storage proyek ini yang boleh diproses Image Optimization.
    // Wildcard hostname ("**") sebelumnya membuat Image Optimization API bisa dipakai
    // untuk mengambil URL arbitrer — vektor yang dipakai GHSA-9g9p-9gw9-jx7f,
    // GHSA-h64f-5h5j-jqjh, GHSA-3x4c-7xq6-9pq8, dan GHSA-2xp9-vwfh-vxw4.
    // Catatan: saat ini tidak ada satupun komponen yang memakai next/image
    // (semua foto dirender dengan <img>), sehingga perubahan ini tidak
    // mempengaruhi tampilan apa pun.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "meswbaeozwkuhzgjkiag.supabase.co",
        pathname: "/storage/v1/object/public/complaint-photos/**",
      },
    ],
  },
};

module.exports = nextConfig;
