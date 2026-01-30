"""
计算文章阅读时间
基于平均阅读速度（中文约 300-400 字/分钟，英文约 200-250 词/分钟）
"""
import re


def count_chinese_characters(text: str) -> int:
    """计算中文字符数"""
    chinese_regex = re.compile(r'[\u4e00-\u9fa5]')
    matches = chinese_regex.findall(text)
    return len(matches)


def count_english_words(text: str) -> int:
    """计算英文单词数"""
    # 移除中文字符后计算英文单词
    text_without_chinese = re.sub(r'[\u4e00-\u9fa5]', ' ', text)
    words = re.findall(r'\b\w+\b', text_without_chinese)
    return len(words)


def strip_markdown(markdown: str) -> str:
    """移除 Markdown 语法标记"""
    text = markdown

    # 移除代码块
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`[^`]*`', '', text)

    # 移除标题标记
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)

    # 移除链接，保留文本
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)

    # 移除图片
    text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', '', text)

    # 移除粗体和斜体标记
    text = re.sub(r'(\*\*|__)(.*?)\1', r'\2', text)
    text = re.sub(r'(\*|_)(.*?)\1', r'\2', text)

    # 移除列表标记
    text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)

    # 移除引用标记
    text = re.sub(r'^\s*>\s+', '', text, flags=re.MULTILINE)

    # 移除水平线
    text = re.sub(r'^\s*[-*_]{3,}\s*$', '', text, flags=re.MULTILINE)

    # 移除 HTML 标签
    text = re.sub(r'<[^>]*>', '', text)

    # 移除多余的空白
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


def calculate_reading_time(
    content: str,
    chinese_wpm: int = 350,      # 中文每分钟字数
    english_wpm: int = 225       # 英文每分钟词数
) -> int:
    """
    计算阅读时间（分钟）

    参数:
        content: Markdown 格式的文章内容
        chinese_wpm: 中文每分钟阅读字数，默认 350
        english_wpm: 英文每分钟阅读词数，默认 225

    返回:
        阅读时间（分钟），至少为 1
    """
    if not content:
        return 1

    # 移除 Markdown 语法
    plain_text = strip_markdown(content)

    # 计算中文字符和英文单词
    chinese_chars = count_chinese_characters(plain_text)
    english_words = count_english_words(plain_text)

    # 计算总阅读时间（分钟）
    chinese_minutes = chinese_chars / chinese_wpm
    english_minutes = english_words / english_wpm
    total_minutes = chinese_minutes + english_minutes

    # 至少显示 1 分钟，四舍五入
    return max(1, round(total_minutes))


def format_reading_time(minutes: int) -> str:
    """
    格式化阅读时间显示

    参数:
        minutes: 分钟数

    返回:
        格式化的文本，如 "约 5 分钟"
    """
    if minutes < 1:
        return '少于 1 分钟'
    elif minutes == 1:
        return '约 1 分钟'
    elif minutes < 60:
        return f'约 {minutes} 分钟'
    else:
        hours = minutes // 60
        remaining_minutes = minutes % 60

        if remaining_minutes == 0:
            return f'约 {hours} 小时'
        else:
            return f'约 {hours} 小时 {remaining_minutes} 分钟'

