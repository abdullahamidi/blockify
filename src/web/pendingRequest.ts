/**
 * Worker'a gönderilmiş, yanıtı henüz gelmemiş en son istek. Worker çökerse (ör. yayından sonra açık kalan
 * sekmede eski worker dosyası yüklenemezse) bu istek ana iş parçacığında yeniden çalıştırılır; yoksa
 * önizleme kullanıcı bir şey değiştirene kadar hiç gelmez.
 */
export function createPending<T extends { id: number }>(): {
  sent(req: T): void;
  answered(id: number): void;
  /** Çökmede bir kez çağrılır: bekleyen istek varsa ve hâlâ en sonuncuysa onu döner; kayıt temizlenir. */
  takeOnFailure(isCurrent: (id: number) => boolean): T | null;
} {
  let pending: T | null = null;
  return {
    sent: (req) => {
      pending = req;
    },
    answered: (id) => {
      if (pending?.id === id) pending = null;
    },
    takeOnFailure: (isCurrent) => {
      const p = pending;
      pending = null;
      return p && isCurrent(p.id) ? p : null;
    },
  };
}
