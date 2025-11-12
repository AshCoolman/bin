
import os
import sys
import fnmatch

def get_all_files(root):
    all_files = []
    for path, _, files in os.walk(root):
        for name in files:
            all_files.append(os.path.join(path, name))
    return all_files

def filter_files(files, ignore_patterns):
    filtered_files = []
    for f in files:
        ignored = False
        re_included = False
        for pattern in ignore_patterns:
            if pattern.startswith('!'):
                if fnmatch.fnmatch(f, pattern[1:]):
                    re_included = True
            elif fnmatch.fnmatch(f, pattern):
                ignored = True
        if not ignored or re_included:
            filtered_files.append(f)
    return filtered_files

if __name__ == '__main__':
    root = sys.argv[1]
    ignore_patterns = sys.argv[2].split(',')
    all_files = get_all_files(root)
    filtered_files = filter_files(all_files, ignore_patterns)
    for f in filtered_files:
        print(f)
