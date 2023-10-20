const axios = require("axios")
const fs = require("fs")

const path = require("path")
const { fileURLToPath, pathToFileURL } = require("url")
const { platform } = require("os")
const moment = require("moment-timezone")
const { format } = require("util")
const FormData = require("form-data")
const mimes = require("mime-types")
const baileys = require("@whiskeysockets/baileys")

  var sleep = (ms) => {
      return new Promise((a) => setTimeout(a, ms));
   }

  var jam = (numer, options = {}) => {
      let format = options.format ? options.format : "HH:mm";
      let jam = options?.timeZone
         ? moment(numer).tz(options.timeZone).format(format)
         : moment(numer).format(format);

      return `${jam}`;
   }

  var tanggal = (numer, timeZone = "") => {
      const myMonths = [
         "Januari",
         "Februari",
         "Maret",
         "April",
         "Mei",
         "Juni",
         "Juli",
         "Agustus",
         "September",
         "Oktober",
         "November",
         "Desember",
      ];
      const myDays = [
         "Minggu",
         "Senin",
         "Selasa",
         "Rabu",
         "Kamis",
         "Jum’at",
         "Sabtu",
      ];
      var tgl = new Date(numer);
      timeZone ? tgl.toLocaleString("en", { timeZone }) : "";
      var day = tgl.getDate();
      var bulan = tgl.getMonth();
      var thisDay = tgl.getDay(),
         thisDay = myDays[thisDay];
      var yy = tgl.getYear();
      var year = yy < 1000 ? yy + 1900 : yy;
      let gmt = new Date(0).getTime() - new Date("1 January 1970").getTime();
      let weton = ["Pahing", "Pon", "Wage", "Kliwon", "Legi"][
         Math.floor((tgl * 1 + gmt) / 84600000) % 5
      ];

      return `${thisDay}, ${day} ${myMonths[bulan]} ${year}`;
   }

 const isUrl = (url) => {
      let regex = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/, "gi")
      if (!regex.test(url)) return false
      return url.match(regex)
   }

   toUpper = (query) => {
      const arr = query.split(" ")
      for (var i = 0; i < arr.length; i++) {
         arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1)
      }

      return arr.join(" ")
      //return query.replace(/^\w/, c => c.toUpperCase())
   }

   getRandom = (ext = "", length = "10") => {
      var result = "";
      var character =
         "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
      var characterLength = character.length;
      for (var i = 0; i < length; i++) {
         result += character.charAt(
            Math.floor(Math.random() * characterLength)
         );
      }

      return `${result}${ext ? `.${ext}` : ""}`;
   }

   formatSize = (bytes, si = true, dp = 2) => {
      const thresh = si ? 1000 : 1024;

      if (Math.abs(bytes) < thresh) {
         return `${bytes} B`;
      }

      const units = si
         ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
         : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
      let u = -1;
      const r = 10 ** dp;

      do {
         bytes /= thresh;
         ++u;
      } while (
         Math.round(Math.abs(bytes) * r) / r >= thresh &&
         u < units.length - 1
      );

      return `${bytes.toFixed(dp)} ${units[u]}`;
   }

   runtime = (seconds) => {
      seconds = Number(seconds);
      var d = Math.floor(seconds / (3600 * 24));
      var h = Math.floor((seconds % (3600 * 24)) / 3600);
      var m = Math.floor((seconds % 3600) / 60);
      var s = Math.floor(seconds % 60);
      var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
      var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
      var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
      var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
      return dDisplay + hDisplay + mDisplay + sDisplay;
   }
   
  exports.sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

   