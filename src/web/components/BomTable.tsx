import type { BomLine } from '../../engine/bom';
import { FILLER_ID } from '../../engine/palette';

interface Props {
  bom: BomLine[];
  /** Toplama listesi modu: tedarik referansları ve işaret kutuları */
  picking?: boolean;
}

export function BomTable({ bom, picking }: Props) {
  const total = bom.reduce((s, l) => s + l.qty, 0);
  return (
    <table className="bom">
      <thead>
        <tr>
          {picking && <th aria-label="Alındı" />}
          <th>Adet</th>
          <th>Parça</th>
          <th>Renk</th>
          {picking && <th>Ref (parça / renk)</th>}
        </tr>
      </thead>
      <tbody>
        {bom.map((l) => (
          <tr key={`${l.color}-${l.part}`}>
            {picking && (
              <td>
                <input type="checkbox" aria-label={`${l.qty} ${l.partName} ${l.colorName} alındı`} />
              </td>
            )}
            <td className="qty">{l.qty}×</td>
            <td>{l.partName}</td>
            <td>
              <span className={`dot ${l.color === FILLER_ID ? 'dot-any' : ''}`} style={{ background: l.colorHex }} />
              {l.colorName}
            </td>
            {picking && (
              <td className="muted small">
                {l.partRef} / {l.color === FILLER_ID ? 'herhangi' : `${l.colorRef} ${l.colorRefName}`}
              </td>
            )}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          {picking && <td />}
          <td className="qty">{total}</td>
          <td colSpan={picking ? 3 : 2}>parça toplam</td>
        </tr>
      </tfoot>
    </table>
  );
}
