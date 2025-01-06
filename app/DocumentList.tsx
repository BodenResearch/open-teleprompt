import React from 'react';
import { Star, StarOff } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type GoogleDoc = {
  id: string;
  name: string;
  starred: boolean;
  modifiedTime: string;
  size: number;
};

export type DocumentListProps = {
  documents: GoogleDoc[];
  setSelectedDocument: (doc: GoogleDoc) => void;
};

export default function DocumentList({ documents, setSelectedDocument }: DocumentListProps) {
  return (
    <div className='w-full overflow-x-auto'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Starred</TableHead>
            <TableHead>Modified</TableHead>
            <TableHead>Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id} className='hover:bg-muted/50 cursor-pointer' onClick={() => setSelectedDocument(doc)}>
              <TableCell>{doc.name}</TableCell>
              <TableCell>
                {doc.starred ? (
                  <Star className='text-primary h-5 w-5' />
                ) : (
                  <StarOff className='text-muted-foreground h-5 w-5' />
                )}
              </TableCell>
              <TableCell>{new Date(doc.modifiedTime).toLocaleString()}</TableCell>
              <TableCell>{(doc.size / 1024).toFixed(2)} KB</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
