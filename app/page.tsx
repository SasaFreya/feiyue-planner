"use client";
import {HubProvider} from '@/features/shared/provider';
import {Notebook} from '@/features/daily-plan/notebook';
import {Workbench} from '@/features/daily-plan/workbench';
export default function Planner(){return <HubProvider><Workbench><Notebook/></Workbench></HubProvider>;}
