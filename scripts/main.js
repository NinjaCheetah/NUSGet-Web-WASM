import { asyncRun, setUpdateCallback } from "./workerApi.js";

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("download-btn").onclick = main;
});

function updateUI(message) {
    let text_box = document.getElementById("download-log")
    const current_text = text_box.innerHTML;
    text_box.innerHTML = `${current_text}${message}<br>`;
    text_box.scrollIntoView(false);
}

// Set the callback
setUpdateCallback(updateUI);

const script2 = `
    import libWiiPy
    def main():
        tid = TID
        title_version = VERSION if VERSION != -1 else None
        wiiu_nus_enabled = True
        endpoint_override = "http://localhost:8000/proxy?url=http://ccs.cdn.wup.shop.nintendo.net/ccs/download/"
    
        # Download the title from the NUS. This is done "manually" (as opposed to using download_title()) so that we can
        # provide verbose output.
        title = libWiiPy.title.Title()
    
        # Announce the title being downloaded, and the version if applicable.
        if title_version is not None:
            send_message(f"Downloading title {tid} v{title_version}, please wait...")
        else:
            send_message(f"Downloading title {tid} vLatest, please wait...")
        send_message(" - Downloading and parsing TMD...")
        # Download a specific TMD version if a version was specified, otherwise just download the latest TMD.
        if title_version is not None:
            title.load_tmd(libWiiPy.title.download_tmd(tid, title_version, wiiu_endpoint=wiiu_nus_enabled,
                                                       endpoint_override=endpoint_override))
        else:
            title.load_tmd(libWiiPy.title.download_tmd(tid, wiiu_endpoint=wiiu_nus_enabled,
                                                       endpoint_override=endpoint_override))
            title_version = title.tmd.title_version
    
        # Download the ticket, if we can.
        send_message(" - Downloading and parsing Ticket...")
        try:
            title.load_ticket(libWiiPy.title.download_ticket(tid, wiiu_endpoint=wiiu_nus_enabled,
                                                             endpoint_override=endpoint_override))
            can_decrypt = True
        except ValueError:
            # If libWiiPy returns an error, then no ticket is available. Log this, and disable options requiring a
            # ticket so that they aren't attempted later.
            send_message("  - No Ticket is available!")
            return
    
        # Load the content records from the TMD, and begin iterating over the records.
        title.load_content_records()
        content_list = []
        for content in range(len(title.tmd.content_records)):
            # Generate the content file name by converting the Content ID to hex and then removing the 0x.
            content_file_name = hex(title.tmd.content_records[content].content_id)[2:]
            while len(content_file_name) < 8:
                content_file_name = "0" + content_file_name
            send_message(f" - Downloading content {content + 1} of {len(title.tmd.content_records)} "
                  f"(Content ID: {title.tmd.content_records[content].content_id}, "
                  f"Size: {title.tmd.content_records[content].content_size} bytes)...")
            content_list.append(libWiiPy.title.download_content(tid, title.tmd.content_records[content].content_id,
                                                                wiiu_endpoint=wiiu_nus_enabled,
                                                                endpoint_override=endpoint_override))
            send_message("   - Done!")
        title.content.content_list = content_list
    
        # # Try to decrypt the contents for this title if a ticket was available.
        # if output_dir is not None:
        #     if can_decrypt is True:
        #         for content in range(len(title.tmd.content_records)):
        #             print(f" - Decrypting content {content + 1} of {len(title.tmd.content_records)} "
        #                   f"(Content ID: {title.tmd.content_records[content].content_id})...")
        #             dec_content = title.get_content_by_index(content)
        #             content_file_name = f"{title.tmd.content_records[content].content_id:08X}".lower() + ".app"
        #             output_dir.joinpath(content_file_name).write_bytes(dec_content)
        #     else:
        #         print("Title has no Ticket, so content will not be decrypted!")
    
        # Get the WAD certificate chain.
        send_message(" - Building certificate...")
        title.load_cert_chain(libWiiPy.title.download_cert_chain(wiiu_endpoint=wiiu_nus_enabled,
                                                                 endpoint_override=endpoint_override))
        # Ensure that the path ends in .wad, and add that if it doesn't.
        send_message("Packing WAD...")
        #if wad_file.suffix != ".wad":
        #    wad_file = wad_file.with_suffix(".wad")
        # # Have libWiiPy dump the WAD, and write that data out.
        #pathlib.Path(wad_file).write_bytes(title.dump_wad())
        
        return title.dump_wad()
    main()
`

let context = {
    TID: "",
    VERSION: 0,
};

async function main() {
    let status_text = document.getElementById("status-text");
    document.getElementById("download-log").innerHTML = "";
    let tid = document.getElementById("tid-entry").value;
    if (tid.length !== 16) {
        console.log("No valid TID entered! Aborting.");
        status_text.innerHTML = "Please enter a valid Title ID.";
        return;
    } else {
        status_text.innerHTML = "";
    }
    context.TID = document.getElementById("tid-entry").value;
    const ver = document.getElementById("ver-entry").value;
    if (ver === "") {
        console.log("No version was specified! Using -1 to signal latest.");
        context.VERSION = -1;
    } else {
        context.VERSION = parseInt(ver);
    }
    const { result, error } = await asyncRun(script2, context);
    if (result) {
        console.log("Download completed");
        const fileName = `${context.TID}-v${(context.VERSION === -1 ? "Latest" : context.VERSION)}.wad`
        await downloadFileB64(result, fileName);
        updateUI(`Downloaded title with Title ID "${context.TID}"!`)
    } else if (error) {
        console.log("pyodideWorker error:", error);
        updateUI("An unknown error occurred. Please check the Title ID and version, then try again.");
        status_text.innerHTML = "An unknown error occurred.";
    }
}

async function downloadFileB64(b64Data, fileName) {
    const a = document.createElement("a");
    a.href = `data:application/octet-stream;base64,${b64Data}`;
    console.log(`Saving file as "${fileName}"`);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
