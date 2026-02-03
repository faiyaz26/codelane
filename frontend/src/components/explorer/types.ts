// File Explorer Types

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_file: boolean;
  is_symlink: boolean;
  size: number | null;
  modified: number | null;
}

export interface TreeNode {
  entry: FileEntry;
  children: TreeNode[];
  isExpanded: boolean;
  isLoading: boolean;
}
