import prunerImport from './pruner';
import gitImport from './git';
import ioImport from './io';

import { allProviderClasses as allProviderClassesImport } from './providers/factories';

export const pruner = prunerImport;
export const git = gitImport;
export const io = ioImport;

export const allProviderClasses = allProviderClassesImport;