const APPS_SCRIPT_URL = "PASTE_YOUR_DEPLOYED_APPS_SCRIPT_WEB_APP_URL_HERE";

document.getElementById("uploadBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("excelUpload");
  const status = document.getElementById("uploadStatus");

  if (!fileInput.files.length) {
    status.textContent = "Please select an Excel file first.";
    return;
  }

  const file = fileInput.files[0];

  status.textContent = "Uploading and importing Excel file...";

  try {
    const base64File = await fileToBase64(file);

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "uploadExcel",
        fileName: file.name,
        mimeType: file.type,
        fileData: base64File
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Import failed.");
    }

    status.textContent = "Excel file imported successfully.";

    await loadTrackerData();

  } catch (error) {
    console.error(error);
    status.textContent = "Error: " + error.message;
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);

    reader.readAsDataURL(file);
  });
}
