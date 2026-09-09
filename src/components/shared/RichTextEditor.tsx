"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Editing height, in px. Long-form fields (waivers) want more. */
  minHeight?: number;
  id?: string;
}

/**
 * The shared rich-text editor for long-form admin fields.
 *
 * Outputs HTML, which is what the landing-page body has always stored, so
 * there is one format across every rich field. The output is still sanitized
 * server-side on save — the schema here constrains the editor, not the API.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  disabled = false,
  className,
  minHeight = 160,
  id,
}: Props) {
  const editor = useEditor({
    // ProseMirror renders on the client only; without this Next warns about a
    // hydration mismatch on every form that mounts an editor.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "rich-text",
        ...(id ? { id } : {}),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // Reset when the form is reused for a different record — but never while the
  // user is typing, or every keystroke would round-trip through the parent and
  // reset the cursor to the end.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className={cn("rounded-md border border-input bg-transparent", className)}
        style={{ minHeight: minHeight + 41 }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rich-text-editor rounded-md border border-input bg-transparent",
        "focus-within:ring-1 focus-within:ring-ring",
        disabled && "opacity-60",
        className,
      )}
    >
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} style={{ ["--rte-min-height" as string]: `${minHeight}px` }} />
    </div>
  );
}

/**
 * Which buttons are lit, and whether undo/redo are available.
 *
 * Read through useEditorState rather than calling editor.isActive() during
 * render: TipTap v3 does not re-render on every transaction, so a plain
 * editor.isActive() is evaluated once and then goes stale — the toolbar would
 * light up the wrong buttons as the caret moves.
 */
function useToolbarState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      blockquote: editor.isActive("blockquote"),
      link: editor.isActive("link"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const s = useToolbarState(editor);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input p-1">
      <Btn disabled={disabled} label="Bold" active={s.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </Btn>
      <Btn disabled={disabled} label="Italic" active={s.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic font-serif">I</span>
      </Btn>
      <Btn disabled={disabled} label="Underline" active={s.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </Btn>
      <Btn disabled={disabled} label="Strikethrough" active={s.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </Btn>

      <Divider />

      <Btn disabled={disabled} label="Heading 2" active={s.h2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </Btn>
      <Btn disabled={disabled} label="Heading 3" active={s.h3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </Btn>

      <Divider />

      <Btn disabled={disabled} label="Bullet list" active={s.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        &#8226;&#8202;&#8212;
      </Btn>
      <Btn disabled={disabled} label="Numbered list" active={s.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.&#8202;&#8212;
      </Btn>
      <Btn disabled={disabled} label="Quote" active={s.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        &ldquo;
      </Btn>

      <Divider />

      <Btn disabled={disabled} label="Link" active={s.link}
        onClick={() => setLink(editor)}>
        &#128279;
      </Btn>
      <Btn disabled={disabled} label="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        &#10005;
      </Btn>

      <Divider />

      <Btn disabled={disabled || !s.canUndo} label="Undo"
        onClick={() => editor.chain().focus().undo().run()}>
        &#8634;
      </Btn>
      <Btn disabled={disabled || !s.canRedo} label="Redo"
        onClick={() => editor.chain().focus().redo().run()}>
        &#8635;
      </Btn>
    </div>
  );
}

/**
 * Link prompting. window.prompt is deliberate: a dialog here would have to
 * nest inside the MUI/Radix dialogs these forms already live in, and focus
 * management across two libraries is not worth it for a URL field.
 */
function setLink(editor: Editor) {
  const current = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL", current ?? "https://");
  if (url === null) return;
  if (url === "" || url === "https://") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

function Btn({
  onClick,
  label,
  active = false,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Without this the button takes DOM focus on mousedown and the caret
      // leaves the editor, so the click formats correctly but whatever the
      // user types next goes nowhere.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs leading-none",
        "hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}
