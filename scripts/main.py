import libWiiPy

def main():
    tid = "0000000100000009"
    title_version = None
    wiiu_nus_enabled = True
    endpoint_override = "http://localhost:8000/proxy?url=http://ccs.cdn.wup.shop.nintendo.net/ccs/download/"

    # Download the title from the NUS. This is done "manually" (as opposed to using download_title()) so that we can
    # provide verbose output.
    title = libWiiPy.title.Title()

    # Announce the title being downloaded, and the version if applicable.
    if title_version is not None:
        print(f"Downloading title {tid} v{title_version}, please wait...")
    else:
        print(f"Downloading title {tid} vLatest, please wait...")
    print(" - Downloading and parsing TMD...")
    # Download a specific TMD version if a version was specified, otherwise just download the latest TMD.
    if title_version is not None:
        title.load_tmd(libWiiPy.title.download_tmd(tid, title_version, wiiu_endpoint=wiiu_nus_enabled,
                                                   endpoint_override=endpoint_override))
    else:
        title.load_tmd(libWiiPy.title.download_tmd(tid, wiiu_endpoint=wiiu_nus_enabled,
                                                   endpoint_override=endpoint_override))
        title_version = title.tmd.title_version

    # Download the ticket, if we can.
    print(" - Downloading and parsing Ticket...")
    try:
        title.load_ticket(libWiiPy.title.download_ticket(tid, wiiu_endpoint=wiiu_nus_enabled,
                                                         endpoint_override=endpoint_override))
        can_decrypt = True
    except ValueError:
        # If libWiiPy returns an error, then no ticket is available. Log this, and disable options requiring a
        # ticket so that they aren't attempted later.
        print("  - No Ticket is available!")
        return

    # Load the content records from the TMD, and begin iterating over the records.
    title.load_content_records()
    content_list = []
    for content in range(len(title.tmd.content_records)):
        # Generate the content file name by converting the Content ID to hex and then removing the 0x.
        content_file_name = hex(title.tmd.content_records[content].content_id)[2:]
        while len(content_file_name) < 8:
            content_file_name = "0" + content_file_name
        print(f" - Downloading content {content + 1} of {len(title.tmd.content_records)} "
              f"(Content ID: {title.tmd.content_records[content].content_id}, "
              f"Size: {title.tmd.content_records[content].content_size} bytes)...")
        content_list.append(libWiiPy.title.download_content(tid, title.tmd.content_records[content].content_id,
                                                            wiiu_endpoint=wiiu_nus_enabled,
                                                            endpoint_override=endpoint_override))
        print("   - Done!")
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
    print(" - Building certificate...")
    title.load_cert_chain(libWiiPy.title.download_cert_chain(wiiu_endpoint=wiiu_nus_enabled,
                                                             endpoint_override=endpoint_override))
    # Ensure that the path ends in .wad, and add that if it doesn't.
    print("Packing WAD...")
    #if wad_file.suffix != ".wad":
    #    wad_file = wad_file.with_suffix(".wad")
    # # Have libWiiPy dump the WAD, and write that data out.
    #pathlib.Path(wad_file).write_bytes(title.dump_wad())

    print(f"Downloaded title with Title ID \"{tid}\"!")
