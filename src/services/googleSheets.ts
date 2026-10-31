import { getAccessToken } from './auth';

export interface ExportStockData {
  title: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number)[][];
}

export const createAndPopulateSpreadsheet = async (
  data: ExportStockData
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('กรุณาเข้าสู่ระบบ Google ก่อนดำเนินการ (No Google Access Token)');
  }

  // 1. Create Spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: data.title,
      },
      sheets: [
        {
          properties: {
            title: data.sheetName || 'สรุปสต็อกสินค้า',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || `สร้าง Google Sheet ไม่สำเร็จ (${createRes.status})`);
  }

  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;
  const spreadsheetUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Populate values
  const allValues = [data.headers, ...data.rows];
  const targetSheet = data.sheetName || 'สรุปสต็อกสินค้า';
  const range = `${targetSheet}!A1`;

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: allValues,
      }),
    }
  );

  if (!updateRes.ok) {
    const errData = await updateRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || `บันทึกข้อมูลลง Google Sheet ไม่สำเร็จ (${updateRes.status})`);
  }

  // 3. Format header styling (Bold, background color, auto-resize)
  try {
    const firstSheetId = created.sheets?.[0]?.properties?.sheetId ?? 0;
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: firstSheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.1, green: 0.45, blue: 0.35 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: firstSheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: data.headers.length,
              },
            },
          },
        ],
      }),
    });
  } catch (err) {
    console.warn('Could not apply advanced formatting to sheet, continuing...', err);
  }

  return { spreadsheetId, spreadsheetUrl };
};
