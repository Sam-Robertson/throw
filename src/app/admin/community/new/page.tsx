import { PostForm } from "../_components/PostForm";

export const metadata = {
  title: "New Post — Admin — Throw",
};

export default function AdminCommunityNewPage() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold">New Community Post</h1>
      <PostForm mode="new" />
    </div>
  );
}
