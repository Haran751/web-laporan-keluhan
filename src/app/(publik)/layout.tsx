import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function PublikLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1 w-full bg-slate-50">{children}</main>
      <Footer />
    </>
  );
}
