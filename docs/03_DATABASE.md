# Database Architecture

# Redmedia AI Growth OS

Version 1.0

---

# Database Philosophy

The database is the heart of the platform.

Every business action must be stored.

Nothing important should exist only in memory.

Every table uses UUID as Primary Key.

Every table supports Multi Tenant architecture.

Every table includes Audit fields.

---

# Global Standards

Primary Key

id UUID

Foreign Keys

*_id UUID

Dates

created_at

updated_at

deleted_at

created_by

updated_by

Tenant

company_id

Indexes

Foreign Keys

Created Dates

Status

Search Fields

JSONB

Only when structure changes frequently.

---

# Core Database Groups

Authentication

Companies

Users

Permissions

CRM

Customers

Reservations

Marketing

Meta Ads

Instagram

Messenger

AI

Memory

Learning

Knowledge

Automation

Reporting

Notifications

Files

Logs

Billing

Settings

---

# AUTHENTICATION

## companies

Stores every company.

Columns

id

name

slug

logo

industry

timezone

language

plan

status

created_at

---

## users

Stores every user.

Columns

id

company_id

first_name

last_name

email

phone

avatar

password_hash

status

last_login

created_at

---

## roles

Admin

Manager

Employee

Support

Marketing

Sales

CEO

---

## permissions

Permission Name

Module

Action

Description

---

## role_permissions

Role

↓

Permission

---

# CRM

## customers

Stores every customer.

Columns

id

company_id

first_name

last_name

email

phone

birthday

gender

source

status

score

tags

notes

assigned_user

created_at

---

## customer_addresses

Multiple addresses.

---

## customer_tags

Unlimited tagging.

---

## customer_notes

Internal notes.

---

## customer_files

Contracts

Images

Documents

Invoices

---

# LEADS

## leads

Potential customers.

Status

New

Contacted

Interested

Qualified

Won

Lost

---

## lead_activities

Calls

Meetings

Emails

DMs

Notes

---

## lead_sources

Instagram

Facebook

Website

Referral

Google

Manual

---

# RESERVATIONS

## reservations

Main reservation table.

Fields

Customer

Package

Status

Start Date

End Date

Price

Discount

Assigned Employee

---

## reservation_services

Each reservation may contain many services.

---

## reservation_payments

Every payment.

Partial payments supported.

---

## reservation_documents

Contracts

Invoices

PDF

---

# PRODUCTS

## services

Wedding

Photo

Video

Drone

Album

Etc.

---

## packages

Bundle of services.

---

## package_items

Package

↓

Services

---

# MARKETING

## campaigns

Stores every campaign.

Platform

Budget

Status

Goal

Start

End

---

## campaign_creatives

Image

Video

Carousel

Reel

Story

---

## audiences

Interest

Lookalike

Remarketing

Broad

---

## campaign_results

CTR

CPM

CPA

ROAS

Reach

Clicks

Conversions

Revenue

---

# META ADS

## meta_accounts

Business IDs

---

## meta_campaigns

Synced campaigns.

---

## meta_adsets

---

## meta_ads

---

## meta_creatives

---

## meta_insights

Daily metrics.

---

# INSTAGRAM

## instagram_accounts

---

## instagram_posts

---

## instagram_reels

---

## instagram_stories

---

## instagram_comments

---

## instagram_messages

Every DM stored.

---

# MESSENGER

## messenger_conversations

---

## messenger_messages

---

# AI

## ai_memories

Long-term memory.

---

## ai_short_memory

Temporary memory.

---

## ai_playbooks

Winning conversations.

Winning campaigns.

Winning automations.

---

## ai_decisions

Every AI decision.

Prompt

Reason

Confidence

Decision

Result

---

## ai_learning_logs

Everything AI learns.

---

## ai_tasks

AI jobs.

Pending

Running

Completed

Failed

---

# COMPANY KNOWLEDGE

## knowledge_articles

Policies

Packages

FAQ

Company Rules

---

## knowledge_categories

---

## knowledge_embeddings

Vector references.

---

# AUTOMATION

## automation_rules

If

Then

Else

---

## automation_history

Every execution.

---

## automation_failures

Every failed automation.

---

# REPORTING

## daily_reports

---

## weekly_reports

---

## monthly_reports

---

## dashboards

Saved dashboards.

---

# FILE STORAGE

## files

Images

Videos

PDF

Contracts

Invoices

---

## folders

Folder hierarchy.

---

# NOTIFICATIONS

## notifications

Email

Push

SMS

WhatsApp

Dashboard

---

## notification_logs

Delivery tracking.

---

# BILLING

## subscriptions

---

## invoices

---

## payments

---

# SETTINGS

## company_settings

General settings.

---

## ai_settings

AI configuration.

---

## meta_settings

Meta configuration.

---

## crm_settings

CRM configuration.

---

## automation_settings

Automation configuration.

---

# LOGGING

## audit_logs

Every action.

---

## api_logs

Every API request.

---

## ai_logs

Every AI execution.

---

## worker_logs

Every background worker.

---

# RELATIONSHIPS

Company

↓

Users

↓

Customers

↓

Reservations

↓

Payments

↓

Reports

Company

↓

Campaigns

↓

Creatives

↓

Insights

↓

AI Learning

↓

Playbooks

Customer

↓

Messages

↓

Reservations

↓

Payments

↓

Files

↓

AI Memory

---

# DATABASE RULES

No hard delete.

Always Soft Delete.

UUID everywhere.

RLS on every business table.

Indexes on foreign keys.

Indexes on created_at.

Audit logs mandatory.

Company isolation mandatory.

Never expose another company's data.

---

End of Document