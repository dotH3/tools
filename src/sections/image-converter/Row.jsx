import { fmtSize } from '../../lib/file.js';

const STATUS = {
  ok: { cls: 'status-ok', text: () => 'Listo' },
  err: { cls: 'status-err', text: (item) => 'Error: ' + item.error },
  converting: { cls: 'status-wait', text: () => 'Convirtiendo…' },
  wait: { cls: 'status-wait', text: () => 'En espera' },
};

export default function Row({ item, onDownload }) {
  const status = STATUS[item.status] || STATUS.wait;

  return (
    <tr>
      <td>
        <img className="thumb" src={item.previewUrl} alt="" />
      </td>
      <td>{item.file.name}</td>
      <td>{fmtSize(item.file.size)}</td>
      <td>{item.resultBlob ? fmtSize(item.resultBlob.size) : '—'}</td>
      <td className={status.cls}>{status.text(item)}</td>
      <td>
        {item.status === 'ok' && <button onClick={() => onDownload(item)}>Descargar</button>}
      </td>
    </tr>
  );
}
