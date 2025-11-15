import express from "express";
import axios from "axios";
import AdmZip from "adm-zip";
import cors from "cors";

import dotenv from "dotenv";
dotenv.config();
const apiUrl = (process.env.API_URL || "https://elecciones.servel.cl")
  .trim()
  .replace(/`/g, "");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Territorios a Nivel Nacional
app.get("/api/territorios/nacional", async (req, res) => {
  try {
    const url = `${apiUrl}/territorios.zip`;
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        Accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://elecciones.servel.cl/",
        Origin: "https://elecciones.servel.cl",
      },
    });
    console.log(`Fetching data from ${url}`);

    const buffer = Buffer.from(response.data);
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const constitucion = zipEntries.find(
      (entry) => entry.entryName === "territorios.json"
    );
    if (!constitucion) {
      return res.status(404).json({
        error: "Archivo constitucion.json no encontrado en el zip",
      });
    }
    const constitucionContent = zip.readAsText(constitucion, "utf8");
    const data = JSON.parse(constitucionContent);
    res.json(data);
  } catch (error) {
    console.error(
      `Error al obtener la constitucion de mesas a nivel nacional desde ${apiUrl}:`,
      error
    );
    res.status(500).json({
      error: `Error al obtener la constitucion de mesas a nivel nacional desde ${apiUrl}`,
    });
  }
});

// Constitucion de Mesas a Nivel Nacional
app.get("/api/resultados/constitucion", async (req, res) => {
  try {
    //https://elecciones.servel.cl/constitucion.zip?v=0.36849739389744063
    const url = `${apiUrl}/constitucion.zip`;
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        Accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://elecciones.servel.cl/",
        Origin: "https://elecciones.servel.cl",
      },
    });
    console.log(`Fetching data from ${url}`);

    const buffer = Buffer.from(response.data);
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const constitucion = zipEntries.find(
      (entry) => entry.entryName === "constitucion.json"
    );
    if (!constitucion) {
      return res.status(404).json({
        error: "Archivo constitucion.json no encontrado en el zip",
      });
    }
    const constitucionContent = zip.readAsText(constitucion, "utf8");
    const data = JSON.parse(constitucionContent);
    res.json(data);
  } catch (error) {
    console.error(
      `Error al obtener la constitucion de mesas a nivel nacional desde ${apiUrl}:`,
      error
    );
    res.status(500).json({
      error: `Error al obtener la constitucion de mesas a nivel nacional desde ${apiUrl}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
