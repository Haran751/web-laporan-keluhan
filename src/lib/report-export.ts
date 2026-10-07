import { formatDate, type CsvComplaintRecord } from './utils';

/**
 * Ekspor laporan rekapitulasi kerusakan dalam format Word (.docx) dan PDF (.pdf).
 * Modul diimpor secara dinamis (dynamic import) agar beban bundle dashboard admin tetap ringan.
 */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const dash = (v: string | null | undefined): string =>
  v === null || v === undefined || v === '' ? '-' : String(v);

interface ReportColumn {
  key: keyof CsvComplaintRecord;
  label: string;
}

const REPORT_COLUMNS: ReportColumn[] = [
  { key: 'nomor_laporan', label: 'Nomor Laporan' },
  { key: 'tanggal_keluhan', label: 'Tanggal Keluhan' },
  { key: 'nama', label: 'Nama Pelapor' },
  { key: 'nip', label: 'NIP Pegawai' },
  { key: 'tim_kerja', label: 'Tim Kerja / Unit' },
  { key: 'nama_barang', label: 'Nama Fasilitas' },
  { key: 'lokasi', label: 'Lokasi / Ruangan' },
  { key: 'status', label: 'Status' },
  { key: 'tanggal_selesai', label: 'Tanggal Selesai' },
  { key: 'deskripsi', label: 'Deskripsi Kerusakan' },
  { key: 'catatan_admin', label: 'Catatan Admin' },
];

export async function downloadComplaintsWord(
  records: CsvComplaintRecord[],
  filename: string = 'laporan-kerusakan.docx'
) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    ShadingType,
    PageOrientation,
  } = await import('docx');

  const headerCell = (text: string) =>
    new TableCell({
      shading: { type: ShadingType.CLEAR, fill: '0F766E' },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18 })],
        }),
      ],
    });

  const bodyCell = (text: string) =>
    new TableCell({
      margins: { top: 50, bottom: 50, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text, size: 18 })],
        }),
      ],
    });

  const rows = [
    new TableRow({
      tableHeader: true,
      children: [...REPORT_COLUMNS.map((c) => c.label), 'Link Foto'].map(headerCell),
    }),
    ...records.map(
      (r) =>
        new TableRow({
          children: [
            ...REPORT_COLUMNS.map((c) => bodyCell(dash(r[c.key]))),
            bodyCell(dash(r.foto_urls)),
          ],
        })
    ),
  ];

  const doc = new Document({
    creator: 'PADUKA',
    title: 'Laporan Rekapitulasi Kerusakan Fasilitas Kantor',
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 16838, // A4 landscape (twips)
              height: 11906,
            },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: 'PADUKA — Pengaduan Kerusakan Fasilitas Kantor' })],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Laporan Rekapitulasi Penanganan Kerusakan Fasilitas Kantor',
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Dicetak: ${formatDate(new Date().toISOString(), true)}  •  Total laporan: ${records.length}`,
                size: 18,
                color: '1E293B',
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`);
}

export async function downloadComplaintsPdf(
  records: CsvComplaintRecord[],
  filename: string = 'laporan-kerusakan.pdf'
) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 118, 110);
  doc.text('PADUKA — Pengaduan Kerusakan Fasilitas Kantor', 40, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Rekapitulasi Penanganan Kerusakan Fasilitas Kantor  •  Dicetak: ${formatDate(
      new Date().toISOString(),
      true
    )}  •  Total laporan: ${records.length}`,
    40,
    56
  );

  // Lebar kolom (satuan pt) — total 724pt, muat dalam A4 landscape dengan margin 40pt.
  const columnWidths: Record<ReportColumn['key'], number> = {
    nomor_laporan: 70,
    tanggal_keluhan: 62,
    nama: 55,
    nip: 62,
    tim_kerja: 55,
    nama_barang: 55,
    lokasi: 55,
    status: 48,
    tanggal_selesai: 52,
    deskripsi: 140,
    catatan_admin: 70,
    foto_urls: 0, // tidak dipakai di PDF (link foto tersedia di ekspor CSV/Word)
  };

  const columnStyles: Record<number, { cellWidth: number }> = {};
  REPORT_COLUMNS.forEach((col, idx) => {
    columnStyles[idx] = { cellWidth: columnWidths[col.key] };
  });

  autoTable(doc, {
    head: [REPORT_COLUMNS.map((c) => c.label)],
    body: records.map((r) => REPORT_COLUMNS.map((c) => dash(r[c.key]))),
    startY: 68,
    margin: { top: 60, right: 40, bottom: 40, left: 40 },
    styles: {
      fontSize: 7,
      cellPadding: 3,
      overflow: 'linebreak',
      valign: 'middle',
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [240, 253, 250] },
    columnStyles,
    didDrawPage: (data) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Halaman ${data.pageNumber}`, pageWidth - 40, pageHeight - 15, { align: 'right' });
    },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}