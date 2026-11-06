/** Eşzamansız yanıtlardan yalnızca en son istenenin geçerli sayılmasını sağlar. */
export function createLatest(): { next(): number; isCurrent(id: number): boolean } {
  let current = 0;
  return {
    next: () => ++current,
    isCurrent: (id) => id === current,
  };
}
