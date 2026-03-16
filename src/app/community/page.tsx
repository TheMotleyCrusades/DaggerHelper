import { CommunityLibrary } from "@/components/adversaries/community-library";
import { ContentCatalog } from "@/components/community/content-catalog";

export default function CommunityPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <header className="mb-4">
        <h1 className="text-2xl text-amber-300">Community Library</h1>
        <p className="text-sm text-slate-300">
          Browse public adversaries and discover installable community content packs.
        </p>
      </header>
      <ContentCatalog />
      <CommunityLibrary />
    </main>
  );
}
