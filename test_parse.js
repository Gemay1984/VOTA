const fs = require('fs');
const PDFExtract = require('pdf.js-extract').PDFExtract;
const pdfExtract = new PDFExtract();
const options = {};
pdfExtract.extract('c:/Users/PC/OneDrive/Escritorio/quindio/Filandia/ZONA 99/E14_CRUCES.pdf', options, (err, data) => {
    if (err) return console.log(err);
    console.log("Pages:", data.pages.length);
    let fullText = '';
    data.pages.forEach(page => {
        page.content.forEach(item => {
            fullText += item.str + ' ';
        });
    });
    console.log("First 1000 characters:");
    console.log(fullText.substring(0, 1000));
    fs.writeFileSync('sample_output.txt', fullText);
    console.log("Wrote full text to sample_output.txt");
});
