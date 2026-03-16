import { CommunityProductDetail } from "@/components/community/product-detail";

export default async function CommunityProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-8">
      <CommunityProductDetail productId={id} />
    </main>
  );
}
