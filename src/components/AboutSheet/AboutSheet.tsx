import { type ReactNode } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/components/sheet/sheet";
import { ArrowUpRight } from "lucide-react";

interface AboutSheetProps {
    readonly isOpen: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

export function AboutSheet({
    isOpen,
    onOpenChange,
}: AboutSheetProps): ReactNode {
    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="about-sheet glass">
                <div className="eyebrow">SOURCE & SCOPE</div>
                <SheetTitle className="structure-title">
                    A body, revealed.
                </SheetTitle>
                <SheetDescription>
                    Explore the adult male reference anatomy from BodyParts3D.
                </SheetDescription>
                <div className="about-copy">
                    <p>
                        <strong>Male · BodyParts3D</strong>
                        <br />
                        2,234 individual meshes and 3,432 named concepts from an
                        adult male reference anatomy.
                    </p>
                    <p>
                        This reference does not contain every human structure or
                        variation. Named concepts can contain multiple pieces;
                        each source mesh is rendered once.
                    </p>
                    <p>
                        Colors and system groupings are designed for
                        exploration. The geometry is simplified for the web, and
                        short explanations provide general educational context.
                        This is an anatomical reference, not a diagnostic or
                        surgical tool.
                    </p>
                    <h3>Source</h3>
                    <p>
                        BodyParts3D, © The Database Center for Life Science
                        licensed under CC Attribution 4.0 International.
                    </p>
                    <a
                        href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Dataset license <ArrowUpRight size={14} />
                    </a>
                    <a
                        href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Original geometry & metadata <ArrowUpRight size={14} />
                    </a>
                    <a
                        href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Read the source publication <ArrowUpRight size={14} />
                    </a>
                </div>
            </SheetContent>
        </Sheet>
    );
}
