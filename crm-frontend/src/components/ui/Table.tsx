import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { forwardRef, HTMLAttributes, ReactNode } from 'react';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
  variant?: 'default' | 'bordered' | 'striped';
  size?: 'sm' | 'md' | 'lg';
}

const Table = forwardRef<HTMLTableElement, TableProps>(
  (
    { className, children, variant = 'default', size = 'md', ...props },
    ref
  ) => {
    const baseStyles = 'w-full text-sm';

    const variants = {
      default: '',
      bordered: 'border border-gray-200',
      striped: '',
    };

    const sizes = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    };

    return (
      <div className="overflow-x-auto">
        <table
          ref={ref}
          className={twMerge(baseStyles, variants[variant], sizes[size], className)}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  }
);

Table.displayName = 'Table';

interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

function TableHeader({ className, children, ...props }: TableHeaderProps) {
  return (
    <thead
      className={twMerge('border-b', className)}
      style={{ background: 'var(--surface-container-low)', borderColor: 'var(--border-light)' }}
      {...props}
    >
      {children}
    </thead>
  );
}

interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

function TableBody({ className, children, ...props }: TableBodyProps) {
  return (
    <tbody
      className={twMerge('divide-y', className)}
      style={{ borderColor: 'var(--border-light)' }}
      {...props}
    >
      {children}
    </tbody>
  );
}

interface TableFooterProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

function TableFooter({ className, children, ...props }: TableFooterProps) {
  return (
    <tfoot
      className={twMerge('border-t', className)}
      style={{ background: 'var(--surface-container-low)', borderColor: 'var(--border-light)' }}
      {...props}
    >
      {children}
    </tfoot>
  );
}

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
  hoverable?: boolean;
}

function TableRow({ className, children, hoverable = true, ...props }: TableRowProps) {
  return (
    <tr
      className={twMerge(
        hoverable ? 'transition-colors hover:bg-[var(--surface-container-low)]' : '',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

interface TableHeadProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
}

function TableHead({ className, children, align = 'left', ...props }: TableHeadProps) {
  return (
    <th
      className={twMerge(
        'px-4 py-3 text-xs font-semibold',
        align === 'left' ? 'text-left' : '',
        align === 'center' ? 'text-center' : '',
        align === 'right' ? 'text-right' : '',
        className
      )}
      style={{ color: 'var(--text-secondary)' }}
      {...props}
    >
      {children}
    </th>
  );
}

interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
}

function TableCell({ className, children, align = 'left', ...props }: TableCellProps) {
  return (
    <td
      className={twMerge(
        'px-4 py-3',
        align === 'left' ? 'text-left' : '',
        align === 'center' ? 'text-center' : '',
        align === 'right' ? 'text-right' : '',
        className
      )}
      style={{ color: 'var(--text-primary)' }}
      {...props}
    >
      {children}
    </td>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
};
