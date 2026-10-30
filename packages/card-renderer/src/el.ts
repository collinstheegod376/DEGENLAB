export type El = {
  type: string;
  props: Record<string, unknown>;
};

export function h(
  type: string,
  props: Record<string, unknown> | null,
  ...children: Array<El | string | null | undefined | false | Array<El | string | null | undefined | false>>
): El {
  const flat = children
    .flat(2)
    .filter((c) => c !== null && c !== undefined && c !== false);
  const style = (props?.style as Record<string, unknown> | undefined) ?? {};
  const next = { ...(props ?? {}) };
  if (type === "div") {
    next.style = { display: "flex", ...style };
  }
  return {
    type,
    props: {
      ...next,
      children: flat,
    },
  };
}
