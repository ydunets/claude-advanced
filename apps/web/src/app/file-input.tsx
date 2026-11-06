type FileInputProps = Omit<React.ComponentProps<'input'>, 'type' | 'className'>;

export function FileInput(props: FileInputProps): React.JSX.Element {
  return (
    <input
      {...props}
      type="file"
      className="h-11 w-full rounded-xl border border-border bg-surface p-1.5 text-sm file:mr-3 file:h-full file:rounded-lg file:border-0 file:bg-default file:px-3 file:text-sm file:font-medium file:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:h-10"
    />
  );
}
