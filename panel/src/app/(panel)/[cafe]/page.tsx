import { redirect } from "next/navigation";

export default async function CafeIndex({ params }: PageProps<"/[cafe]">) {
  const { cafe } = await params;
  redirect(`/${cafe}/masalar`);
}
