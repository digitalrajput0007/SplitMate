import sys
import os
import zipfile
import struct
import io

PT_LOAD = 1

def check_elf(name, data):
    if len(data) < 64:
        return {"name": name, "error": "File too small for ELF header"}
    if data[:4] != b'\x7fELF':
        return {"name": name, "error": "Not an ELF file"}
    
    ei_class = data[4]
    ei_data = data[5]
    
    is_64bit = (ei_class == 2)
    endian = '<' if ei_data == 1 else '>'
    
    if not is_64bit:
        return {
            "name": name,
            "arch": "32-bit",
            "status": "SKIPPED_32BIT",
            "min_align": 4096,
            "compatible": True,
            "segments": []
        }
    
    # 64-bit ELF
    # e_phoff: offset 0x20, uint64
    # e_phentsize: offset 0x36, uint16
    # e_phnum: offset 0x38, uint16
    e_phoff = struct.unpack_from(endian + 'Q', data, 0x20)[0]
    e_phentsize = struct.unpack_from(endian + 'H', data, 0x36)[0]
    e_phnum = struct.unpack_from(endian + 'H', data, 0x38)[0]
    
    segments = []
    all_aligned = True
    min_align = None
    
    for i in range(e_phnum):
        ph_offset = e_phoff + i * e_phentsize
        if ph_offset + 56 > len(data):
            break
        
        # Elf64_Phdr:
        # uint32 p_type    (0)
        # uint32 p_flags   (4)
        # uint64 p_offset  (8)
        # uint64 p_vaddr   (16)
        # uint64 p_paddr   (24)
        # uint64 p_filesz  (32)
        # uint64 p_memsz   (40)
        # uint64 p_align   (48)
        p_type, p_flags, p_offset, p_vaddr, p_paddr, p_filesz, p_memsz, p_align = struct.unpack_from(
            endian + 'IIQQQQQQ', data, ph_offset
        )
        
        if p_type == PT_LOAD:
            if min_align is None or p_align < min_align:
                min_align = p_align
            
            # Check 16 KB (16384 = 0x4000)
            is_16kb = (p_align >= 16384) and ((p_vaddr % p_align) == (p_offset % p_align))
            if not is_16kb:
                all_aligned = False
            
            segments.append({
                "idx": i,
                "p_offset": hex(p_offset),
                "p_vaddr": hex(p_vaddr),
                "p_filesz": p_filesz,
                "p_memsz": p_memsz,
                "p_align": hex(p_align),
                "p_align_dec": p_align,
                "aligned_16kb": is_16kb
            })
            
    return {
        "name": name,
        "arch": "64-bit",
        "status": "PASS" if all_aligned else "FAIL",
        "min_align": min_align,
        "compatible": all_aligned,
        "segments": segments
    }

def check_file(path):
    print(f"Checking target: {path}")
    if path.endswith('.aab') or path.endswith('.apk') or path.endswith('.zip'):
        with zipfile.ZipFile(path, 'r') as z:
            so_files = [f for f in z.namelist() if f.endswith('.so')]
            print(f"Found {len(so_files)} shared libraries (.so) in package.")
            results = []
            for so_name in sorted(so_files):
                data = z.read(so_name)
                res = check_elf(so_name, data)
                results.append(res)
            return results
    elif path.endswith('.so'):
        with open(path, 'rb') as f:
            data = f.read()
        return [check_elf(os.path.basename(path), data)]
    elif os.path.isdir(path):
        results = []
        for root, dirs, files in os.walk(path):
            for file in files:
                if file.endswith('.so'):
                    full_p = os.path.join(root, file)
                    rel_p = os.path.relpath(full_p, path)
                    with open(full_p, 'rb') as f:
                        data = f.read()
                    results.append(check_elf(rel_p, data))
        return results
    else:
        print(f"Unsupported file: {path}")
        return []

def main():
    if len(sys.argv) < 2:
        print("Usage: python check_16kb.py <path_to_aab_or_apk_or_so_or_dir>")
        sys.exit(1)
        
    path = sys.argv[1]
    results = check_file(path)
    
    print("\n" + "="*80)
    print(f"{'LIBRARY':<45} | {'ARCH':<7} | {'MIN ALIGN':<10} | {'STATUS'}")
    print("="*80)
    
    total_64bit = 0
    passed_64bit = 0
    failed_64bit = 0
    
    for r in results:
        if "error" in r:
            print(f"{r['name']:<45} | ERROR: {r['error']}")
            continue
        arch = r['arch']
        min_align_str = f"{r.get('min_align', 'N/A')} B" if r.get('min_align') else "N/A"
        if arch == "64-bit":
            total_64bit += 1
            if r['compatible']:
                passed_64bit += 1
                status_str = "PASS (16 KB+)"
            else:
                failed_64bit += 1
                status_str = "FAIL (4 KB)"
        else:
            status_str = "SKIP (32-bit)"
            
        print(f"{r['name']:<45} | {arch:<7} | {min_align_str:<10} | {status_str}")
        
    print("="*80)
    print(f"SUMMARY: Total 64-bit .so files: {total_64bit} | Compatible: {passed_64bit} | Non-compatible: {failed_64bit}")
    if failed_64bit > 0:
        print("\n[!] WARNING: Non-compatible libraries detected! App does NOT meet Google Play 16 KB requirements.")
        for r in results:
            if r.get('arch') == "64-bit" and not r.get('compatible'):
                print(f"  - {r['name']} (min_align: {r.get('min_align')} bytes)")
        sys.exit(1)
    else:
        print("\n[SUCCESS] ALL 64-bit libraries are aligned to 16 KB (0x4000) or higher!")
        sys.exit(0)

if __name__ == '__main__':
    main()
