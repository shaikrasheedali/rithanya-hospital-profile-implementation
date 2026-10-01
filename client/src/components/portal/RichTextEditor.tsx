"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Pilcrow, Quote, Redo2, RemoveFormatting, Underline, Undo2 } from "lucide-react";
import { MediaPickerModal } from "@/components/portal/MediaPicker";

/** Lightweight WYSIWYG engine (contentEditable). Output is sanitised again on the server. */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => ref.current && onChange(ref.current.innerHTML);
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };
  const remember = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const tools: Array<[React.ComponentType<{ className?: string }>, string, () => void]> = [
    [Bold, "Bold", () => exec("bold")],
    [Italic, "Italic", () => exec("italic")],
    [Underline, "Underline", () => exec("underline")],
    [Heading2, "Heading 2", () => exec("formatBlock", "H2")],
    [Heading3, "Heading 3", () => exec("formatBlock", "H3")],
    [Pilcrow, "Paragraph", () => exec("formatBlock", "P")],
    [List, "Bulleted list", () => exec("insertUnorderedList")],
    [ListOrdered, "Numbered list", () => exec("insertOrderedList")],
    [Quote, "Quote", () => exec("formatBlock", "BLOCKQUOTE")],
    [
      Link2,
      "Link",
      () => {
        const url = window.prompt("Link URL (https://…)");
        if (url && /^(https?:|mailto:|tel:|\/)/i.test(url)) exec("createLink", url);
      },
    ],
    [
      ImagePlus,
      "Insert image",
      () => {
        remember();
        setPicker(true);
      },
    ],
    [RemoveFormatting, "Clear formatting", () => exec("removeFormat")],
    [Undo2, "Undo", () => exec("undo")],
    [Redo2, "Redo", () => exec("redo")],
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white focus-within:border-royal focus-within:ring-2 focus-within:ring-royal/20">
      <div className="flex flex-wrap gap-1 border-b border-line bg-canvas p-2" role="toolbar" aria-label="Formatting">
        {tools.map(([Icon, label, fn]) => (
          <button key={label} type="button" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={fn} className="rounded-md p-2 text-navy hover:bg-white hover:text-royal">
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Rich text content"
        data-placeholder="Start writing…"
        onInput={emit}
        onBlur={() => {
          remember();
          emit();
        }}
        className="editor-surface prose-rh max-h-[28rem] overflow-y-auto p-4 focus:outline-none"
      />
      {picker && (
        <MediaPickerModal
          single
          imagesOnly
          onClose={() => setPicker(false)}
          onPick={(a) => {
            setPicker(false);
            ref.current?.focus();
            restore();
            document.execCommand("insertImage", false, a[0].url);
            emit();
          }}
        />
      )}
    </div>
  );
}
