
  function downloadAssessmentPDF() {
    if (!selected) {
      alert("Please select a client assessment first.");
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("The PDF library did not load. Check your internet connection and refresh the page.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    function checkPage(height = 8) {
      if (y + height > pageHeight - 15) {
        doc.addPage();
        y = 20;
      }
    }

    function writeText(text, options = {}) {
      const size = options.size || 9.5;
      const bold = Boolean(options.bold);
      const gap = options.gap === undefined ? 3 : options.gap;
      const indent = options.indent || 0;

      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);

      const lines = doc.splitTextToSize(
        String(text == null || text === "" ? "—" : text),
        contentWidth - indent
      );

      const lineHeight = size * 0.45 + 1.5;
      checkPage(lines.length * lineHeight + gap);
      doc.text(lines, margin + indent, y);
      y += lines.length * lineHeight + gap;
    }

    function writeSection(title) {
      checkPage(15);
      y += 3;

      doc.setFillColor(35, 35, 35);
      doc.rect(margin, y - 4, contentWidth, 9, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(title, margin + 3, y + 1.5);

      doc.setTextColor(30, 30, 30);
      y += 10;
    }

    function safeFilename(value) {
      return String(value || "Client")
        .replace(/[^a-z0-9_-]/gi, "_")
        .replace(/_+/g, "_")
        .slice(0, 80);
    }

    const clientCode =
      "RWF-" + String(selected.client_number || 0).padStart(6, "0");

    // Header
    doc.setFillColor(190, 25, 45);
    doc.rect(0, 0, pageWidth, 34, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("RAWWAYFIT", margin, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("CLIENT FITNESS ASSESSMENT", margin, 23);

    doc.setTextColor(30, 30, 30);
    y = 43;

    // Client details
    writeSection("CLIENT DETAILS");
    writeText(`Client number: ${clientCode}`);
    writeText(`Full name: ${selected.client_name || "—"}`);
    writeText(`Phone / WhatsApp: ${selected.phone || "—"}`);
    writeText(`Email: ${selected.client_email || "—"}`);
    writeText(`Assessment submitted: ${formatDate(selected.created_at)}`);
    writeText(`PDF generated: ${new Date().toLocaleDateString("en-IN")}`);

    // Export all nine sections currently displayed in the assessment.
    const sections = Array.from(
      assessmentDetails.querySelectorAll(".rw-assessment-section")
    );

    sections.forEach(section => {
      const summary = section.querySelector("summary");
      writeSection(summary ? summary.innerText.trim() : "Assessment details");

      const rows = Array.from(
        section.querySelectorAll(".rw-detail-row")
      );

      if (!rows.length) {
        writeText("No answers provided.");
        return;
      }

      rows.forEach(row => {
        const labelElement = row.querySelector(".rw-detail-label");
        const valueElement = row.querySelector(".rw-detail-value");

        const label = labelElement
          ? labelElement.innerText.trim()
          : "Answer";

        const value = valueElement
          ? valueElement.innerText.trim()
          : "—";

        writeText(`${label}: ${value}`, { indent: 2 });
      });
    });

    // Trainer notes
    writeSection("TRAINER REVIEW");
    writeText(`Training status: ${$("trainingStatus").value || "Lead"}`);
    writeText(
      `Assessment summary: ${$("trainerSummary").value.trim() || "—"}`
    );
    writeText(
      `Initial plan / recommendations: ${$("initialPlan").value.trim() || "—"}`
    );
    writeText(`Next review date: ${formatDate($("nextReviewDate").value)}`);

    // Page numbers and confidentiality footer
    const pageCount = doc.internal.getNumberOfPages();

    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);

      doc.text(
        "RAWWAYFIT | Confidential Client Assessment",
        margin,
        pageHeight - 7
      );

      doc.text(
        `Page ${page} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - 7,
        { align: "right" }
      );
    }

    const filename =
      `RAWWAYFIT_${safeFilename(clientCode)}_` +
      `${safeFilename(selected.client_name)}_Assessment.pdf`;

    doc.save(filename);
  }
// Download PDF button
const downloadButton = document.getElementById("downloadAssessmentButton");

if (downloadButton) {
  downloadButton.addEventListener("click", function () {
    downloadAssessmentPDF();
  });
}